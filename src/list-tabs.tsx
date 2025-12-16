import { Action, ActionPanel, List, showToast, Toast } from "@raycast/api";
import { runAppleScript, useCachedPromise } from "@raycast/utils";

const LIST_TABS_SCRIPT = `
tell application "System Events"
  tell process "Zed"
    set theMenu to menu 1 of menu bar item "Window" of menu bar 1
    set theItems to menu items of theMenu
    set foundSeparators to 0
    set tabNames to {}
    repeat with mi in theItems
      set t to name of mi
      if t is missing value then
        set foundSeparators to foundSeparators + 1
      else if foundSeparators >= 4 then
        set end of tabNames to t
      end if
    end repeat
    set AppleScript's text item delimiters to "|||"
    return tabNames as text
  end tell
end tell
`;

function switchToTabScript(tabName: string): string {
  const escaped = tabName.replace(/"/g, '\\"');
  return `
tell application "System Events"
  tell process "Zed"
    set theMenu to menu 1 of menu bar item "Window" of menu bar 1
    set theItems to menu items of theMenu
    repeat with mi in theItems
      set t to name of mi
      if t is not missing value and t is "${escaped}" then
        click mi
        tell application "Zed" to activate
        return t
      end if
    end repeat
  end tell
end tell
error "No match for: ${escaped}"
`;
}

interface Tab {
  name: string;
  project: string;
  file: string | null;
}

function parseTabName(name: string): Tab {
  const parts = name.split(" — ");
  if (parts.length === 2) {
    return { name, project: parts[0], file: parts[1] };
  }
  return { name, project: name, file: null };
}

async function fetchTabs(): Promise<Tab[]> {
  const result = await runAppleScript(LIST_TABS_SCRIPT);
  const tabNames = result.split("|||").filter(Boolean);
  return tabNames.map(parseTabName);
}

export default function Command() {
  const { isLoading, data: tabs, revalidate } = useCachedPromise(fetchTabs);

  async function handleSwitchTab(tab: Tab) {
    try {
      await runAppleScript(switchToTabScript(tab.name));
    } catch (error) {
      showToast({
        style: Toast.Style.Failure,
        title: "Failed to switch tab",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search Zed tabs...">
      {tabs?.map((tab, index) => (
        <List.Item
          key={index}
          title={tab.project}
          subtitle={tab.file ?? undefined}
          actions={
            <ActionPanel>
              <Action title="Switch to Tab" onAction={() => handleSwitchTab(tab)} />
              <Action title="Refresh" shortcut={{ modifiers: ["cmd"], key: "r" }} onAction={() => revalidate()} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
