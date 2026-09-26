# Create client onboarding tasks from an Airtable start date

Start each client with the same clear handoff plan, while keeping their tasks and dates separate.

Several clients may be onboarding at once, each with tasks that start on different days. Copying the plan by hand can leave out a task or attach a due date to the wrong client.

This example watches for a client entering a ready view in Airtable. It reads up to 100 active task templates and creates client-linked task records with dates calculated from the client’s start date. When a task is marked Done, it can alert the configured next owner in Slack.

## Set it up with a coding agent

Copy the setup prompt from [the article](https://automate.ax/articles/airtable-client-onboarding) into your coding agent. The agent creates the Automate.ax project, asks for your choices, guides account authorization, checks the automation, and deploys it. You do not need to clone this repository yourself when using the prompt.

You'll choose:

- Which client record should start onboarding and which field holds its start date. The agent can create a ready grid view filtered to complete records where Tasks Generated is unchecked.
- The task names, start offsets, durations, and next-owner handoffs. The agent can create the task template if needed.
- The destination table for client-linked onboarding tasks.
- The Slack channel and owner IDs for task handoffs.
- Account authorization for Airtable and Slack.

## Manual setup

If you prefer to set it up yourself:

```sh
git clone https://github.com/SentsCo/automate-ax-airtable-client-onboarding.git
cd automate-ax-airtable-client-onboarding
bun install
bunx automate.ax login
bunx automate.ax init
bun run typecheck
bunx automate.ax deploy
```

Connect the accounts requested by Automate.ax when you deploy. The platform stores credentials outside this repository. Set any project parameters requested by the automation, then review the read and write operations before turning it on.

## Check a run

Move a disposable client record into the ready view with a known start date. Compare the task count, client links, and calculated dates with the template. Mark one task Done and check the next-owner Slack handoff. Remove the test records when you are done.

## Limits

- Dates are calculated when onboarding starts; a later delay does not automatically reschedule dependent tasks.
- Changing a task template does not retroactively edit work already created for an existing client.
- The automation creates large task sets in batches. If a later batch fails, earlier tasks remain; check for partial work before retrying to avoid duplicates.
- Use a supported Airtable grid view and check webhook capacity on the base before enabling the trigger.

The workflow responds to [a real problem described by an Airtable user’s 90-day onboarding question](https://www.reddit.com/r/Airtable/comments/zpelu7). The public report informed the example; it is not an endorsement of this implementation.
