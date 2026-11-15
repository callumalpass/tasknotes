---
description: Use the tasks in your Obsidian vault in TaskNotes App on the web, iPhone and Android by syncing the vault with mdbase Connect.
---

# Use TaskNotes App with your vault

TaskNotes App is TaskNotes for the web, iPhone and Android. It works with the same Markdown task notes as the Obsidian plugin, so a task you edit in the app is the same note you see in Obsidian.

- Web: [app.tasknotes.dev](https://app.tasknotes.dev/)
- iPhone: [TaskNotes in the App Store](https://apps.apple.com/app/tasknotes/id6797168033)
- Android: [TaskNotes on Google Play](https://play.google.com/store/apps/details?id=dev.tasknotes.app)

In Obsidian, **Settings → TaskNotes → TaskNotes App** has the same links, QR codes for the App Store and Google Play, and the setup steps below. The **TaskNotes: Set up TaskNotes App** command opens that page.

## Try it first

Open [app.tasknotes.dev](https://app.tasknotes.dev/) in a browser. Without an account, it opens an empty collection that is saved only in that browser, so you can try it straight away. It does not show the tasks in your vault until you sync the vault, as described below.

## How TaskNotes App reaches your vault

TaskNotes App cannot open files on your computer by itself. The mdbase Connect desktop app syncs your vault folder with your mdbase Connect account, and TaskNotes App signs in to the same account. The vault stays where it is, as ordinary Markdown files, and Obsidian keeps working with it as before.

You need:

- TaskNotes 5.0 or later in Obsidian, on every device that uses the vault. TaskNotes 4 can overwrite the task definitions that TaskNotes App uses.
- The [mdbase Connect desktop app](https://mdbase.dev/downloads/) for macOS, Windows or Linux, on the computer that has your vault. mdbase Connect is in beta.
- An mdbase Connect account. You can create one from the desktop app.

Back up your vault before you start. See [Backup, restore, and removal](backup-recovery.md).

## Set up

1. In Obsidian, open **Settings → TaskNotes → TaskNotes App** and turn on **Turn on type definitions**. TaskNotes writes `mdbase.yaml` and the task type that TaskNotes App reads. New installs of TaskNotes 5 have this on already; vaults updated from TaskNotes 4 keep the setting they had. See [Integrations](../settings/integrations.md#mdbase).
2. Install [mdbase Connect](https://mdbase.dev/downloads/) on the computer that has your vault and open it. Choose **Sign in with your browser**, sign in or create an account, then choose **Approve computer**.
3. In mdbase Connect, choose **Add existing folder** and select your vault's folder. To find the folder, choose **Copy folder path** on the same settings page.
4. Open **Collections**, open the vault's **…** menu and choose **Turn on sync**, then choose **Turn on sync** again. mdbase Connect uploads the files in the folder and keeps them in sync. The folder stays where it is.
5. Open TaskNotes App on the web, iPhone or Android, sign in with the same account, choose the collection and choose **Open TaskNotes**.
6. The first time, TaskNotes App asks to set up the collection. Choose **Set up**, or **Continue** if nothing needs to change.

**Before step 6,** update TaskNotes to version 5 on every device that uses the vault. TaskNotes App's setup writes the task type whether or not type definitions are turned on in Obsidian, and a device still running TaskNotes 4 with **Generate mdbase type definitions** turned on can overwrite it.

After step 3, **Settings → TaskNotes → TaskNotes App** shows the vault as added to mdbase Connect.

## Use one sync service per vault

Once mdbase Connect syncs the vault, stop syncing it with any other service, such as Obsidian Sync, iCloud Drive, Dropbox, OneDrive, Google Drive or Syncthing. Two services syncing the same folder can create conflicting copies of your notes.

- **Other computers:** install mdbase Connect on each computer where you use the vault in Obsidian, sync the collection to a folder there, and open that folder as a vault in Obsidian.
- **Phones:** Obsidian on iPhone and Android cannot sync through mdbase Connect. On your phone, use TaskNotes App for your tasks.

If you rely on another service to use the whole vault in Obsidian on your phone, keep using it, and don't sync the vault with mdbase Connect.

## What changes in your vault

- `mdbase.yaml` and the `_mdbase/` folder hold the task definitions and the TaskNotes settings record that the plugin and the app share. They are hidden in the file explorer by default. See [Integrations](../settings/integrations.md#mdbase).
- mdbase Connect keeps its sync state in the hidden `.mdbase/` folder. Don't edit or delete it.
- Tasks created or changed in TaskNotes App are ordinary task notes, written in the same format as the plugin's.

## Use your tasks from Claude

The same setup lets AI apps such as Claude reach your tasks, even when Obsidian is closed. Add the [mdbase MCP server](https://mdbase.dev/apps/mcp/) to your AI app and approve the collection. TaskNotes' own [HTTP API](../HTTP_API.md) and MCP server work only while Obsidian is open on that computer.

## Stop syncing

In mdbase Connect, remove the collection. Apps stop using it, and the folder and its files stay where they are.
