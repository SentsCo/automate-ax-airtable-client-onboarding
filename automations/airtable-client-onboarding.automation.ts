import { automation, transform, withPrerequisites, t } from "automate.ax"
import { airtable } from "automate.ax/airtable"
import { slack } from "automate.ax/slack"
import { z } from "zod"

export default automation(
  "Start client onboarding from an Airtable template",
  {
    parameters: [
      { label: "Airtable base ID", name: "baseId", type: "text" },
      { label: "Ready clients view ID", name: "readyViewId", type: "text" },
      {
        label: "Task templates table ID",
        name: "templatesTableId",
        type: "text",
      },
      {
        label: "Onboarding tasks table ID",
        name: "tasksTableId",
        type: "text",
      },
      { label: "Task status field ID", name: "statusFieldId", type: "text" },
      {
        label: "Handoff Slack channel ID",
        name: "slackChannelId",
        type: "text",
      },
    ],
  },
  ({ parameters }) => {
    const newClient = airtable.onRecordMovedIntoView({
      baseId: parameters.baseId,
      viewId: parameters.readyViewId,
    })

    withPrerequisites(newClient, () => {
      const client = airtable.getRecord({
        baseId: parameters.baseId,
        table: newClient.tableId,
        recordId: newClient.recordId,
      })
      const templates = airtable.listRecords({
        baseId: parameters.baseId,
        table: parameters.templatesTableId,
        filterByFormula: "{Active} = 1",
        maxRecords: 100,
      })

      const tasks = transform(
        [client, templates],
        (clientRecord, templateList) => {
          const { Name: clientName, "Start Date": startDate } = z
            .object({ Name: z.string().min(1), "Start Date": z.iso.date() })
            .parse(clientRecord.fields)
          const dayZero = Date.parse(`${startDate}T00:00:00Z`)

          return templateList.records.map(({ fields }) => {
            const template = z
              .object({
                Name: z.string().min(1),
                "Start Offset Days": z.number().int().nonnegative(),
                "Duration Days": z.number().int().nonnegative(),
                "Next Task Name": z.string().optional(),
                "Next Owner Slack ID": z.string().optional(),
              })
              .parse(fields)
            const start = new Date(
              dayZero + template["Start Offset Days"] * 86_400_000,
            )
              .toISOString()
              .slice(0, 10)
            const due = new Date(
              dayZero +
                (template["Start Offset Days"] + template["Duration Days"]) *
                  86_400_000,
            )
              .toISOString()
              .slice(0, 10)

            return {
              fields: {
                Name: template.Name,
                Client: [clientRecord.id],
                "Client Name": clientName,
                "Start Date": start,
                "Due Date": due,
                Status: "Not started",
                "Next Task Name": template["Next Task Name"] ?? "",
                "Next Owner Slack ID": template["Next Owner Slack ID"] ?? "",
              },
            }
          })
        },
      ).filter((rows) => rows.length > 0)

      const created = airtable.createRecords({
        baseId: parameters.baseId,
        table: parameters.tasksTableId,
        records: tasks,
      })

      withPrerequisites(created, () =>
        airtable.updateRecord({
          baseId: parameters.baseId,
          table: newClient.tableId,
          recordId: newClient.recordId,
          fields: { "Tasks Generated": true },
        }),
      )
    })

    const completed = airtable
      .onRecordUpdated({
        baseId: parameters.baseId,
        tableId: parameters.tasksTableId,
      })
      .filter(
        ({ changedFieldIds, fields }) =>
          changedFieldIds.includes(parameters.statusFieldId) &&
          fields[parameters.statusFieldId] === "Done",
      )

    const handoff = airtable
      .getRecord({
        baseId: parameters.baseId,
        table: parameters.tasksTableId,
        recordId: completed.recordId,
      })
      .transform(({ fields }) => {
        const task = z
          .object({
            "Client Name": z.string(),
            "Next Task Name": z.string().optional(),
            "Next Owner Slack ID": z.string().optional(),
          })
          .parse(fields)
        return {
          clientName: task["Client Name"],
          nextTask: task["Next Task Name"] ?? "",
          nextOwner: task["Next Owner Slack ID"] ?? "",
        }
      })
      .filter(({ nextOwner, nextTask }) => Boolean(nextOwner && nextTask))

    slack.sendMessage({
      conversation: parameters.slackChannelId,
      text: t`<@${handoff.nextOwner}> — ${handoff.clientName} is ready for ${handoff.nextTask}.`,
    })
  },
)
