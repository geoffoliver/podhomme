@AGENTS.md

This is an app for listening to podcasts from a web browser. The use case is for a group of people listening to podcasts in different rooms or locations, that any of those people can open a web page and "do things" with the podcasts - control playback, manage subscriptions, etc. The app should update for all users in real time, so that changes are visible to everyone without needing to refresh the page. The app should also expose metadata and playback controls so that it can be controlled from BeardedSpice (I'll also need a "MediaStrategy" for BeardedSpice :-)).

# Main UI
The main interface for the application should be very simple - a top bar with transport controls and currently playing info (think of any media player), and below that, a split pane view. There is no authentication for the application - if you know the URL, you can control the podcasts.

## Top Bar
The top bar should display transport controls (play, pause, skip forward, skip back, next, previous), the playback progress (time remaining/time progressed (changeable by clicking) and total time, along with a progress bar), the image or "album art" associated with the currently playing file (or the currently playing file's main podcast image if the currently playing file does not have an image associated with it), and the title of the episode. Basically, it should look and function like the old school iTunes top bar.

The top bar should also include a button that will let users access the application settings.

## Split Pane
The split pane is the main area where users will interact with the application.

### Left Pane
The left pane lists all of the subscribed podcasts with an "All Podcasts" item at the very top of the list. Each podcast should include an iconographic representation of the podcast image, or a generic icon (the "podcast" icon from Lucide) if no image is present. Users should be able to click (or use the keyboard) to select an item in the list, which will change what appears in the right pane. Additionally, the bottom of the left pane should include a row of buttons. A "+" button that, when pressed, will prompt the user to enter a podcast RSS feed URL, which will add the podcast to the list of subscribed podcasts; A button that allows users to import existing subscriptions from an OPML file; A button to refresh all of the feeds. When a feed (or feeds) are freshing, a status bar should appear above the button bar that tells the user what is happening (i.e. Refreshing "Never Not Funny" (3 of 30)).

### Right Pane
If the "All Podcasts" option is selected, unplayed episodes of all subscribed podcasts should be displayed, by default in ascending (by date) order, but the user should be able to manually rearrange the items, and the order should persist page reloads. The page should also give the user the ability to sort the list by date in ascending or descending order automatically.

If an individual podcast is selected, a view of the selected podcast should be displayed. The view will be split into two main parts.

### The top part
The top part will includes all the pertinent metadata - podcast name, description, image, link, etc. - and buttons to (a) delete/unsubscribe (b) refresh the feed. and below that, all the episodes for the podcast should be displayed, with an indicator to show users which episodes have been listened to.

### The bottom part
The bottom part will list out individual episodes and give users the ability to trigger the playback of an episode, view more info about the episode, or perform other actions (download the file to their computer, mark the episode as played/unplayed, etc.)

#### Individual Episode UI
Each episode should display as a row with the album art (or podcast image) on the left, the title, date, runtime, and a truncated (4 lines max) description to the right of the image, and a menu all the way on the right. The title should be clickable and display a detail view of the episode when clicked.

##### Individual Episode Detail UI
The episode detail should display in a modal dialog and include all of the info that someone might want to see when looking at the details of an episode - the title, the date, the full description, and whatever else.

## Settings
The settings should include:
- Refresh frequency (30 minutes, 1 hour, 3 hours, 12 hours, 1 day)
- How many episodes to keep (1, 2, 3, 5, all unplayed, all)
- Default playback (streaming or download)
- Download location

# Backend
The backend should periodically update the feeds (based on the "refresh frequency" setting) and check for new entries. If new entries are found, they should be downloaded (if the settings specify as much) and added to the "unplayed" list.

# Minutiae
Whenever possible, use standard HTML features. For example, `<dialog>` for modal dialogs, `<div popover="...">` for popover menus, and so on.

Create a global stylesheet for styling buttons, inputs, etc. and use the `@apply` function that Tailwind provides. Stylesheets should be formatted like this:

```
.className {
  @apply
    border
    border-neutral-300
    ...
}
```
Putting the `@apply` on a line after the opening `{`, indented 2 spaces, and then below that, indented by 4 spaces, the style rule/declaration/whatever, one per line.

Any styling other than the global stylesheet should be done in CSS modules that live alongside the components they are styling, and when possible, should be named `index.module.css`.

Always keep the CHANGELOG.md and README.md up-to-date.

# Tech
- DB: SQLite/Prisma
- Icons: Lucide
- Runtime: Bun
- Host OS: MacOS (Intel)
- Package manager: yarn
- Styling: Tailwind
- Process Management: PM2
