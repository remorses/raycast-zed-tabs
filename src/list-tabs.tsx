import { Action, ActionPanel, Icon, List, showToast, Toast } from "@raycast/api";
import { runAppleScript, useCachedPromise } from "@raycast/utils";
import ColorHash from "color-hash";

const colorHash = new ColorHash({ saturation: 0.7, lightness: 0.6 });

const LIST_TABS_SCRIPT = `
tell application "System Events"
  tell process "Zed"
    set theMenu to menu 1 of menu bar item "Window" of menu bar 1
    set theItems to menu items of theMenu
    set foundSeparators to 0
    set results to {}
    set idx to 0
    repeat with mi in theItems
      set idx to idx + 1
      set t to name of mi
      if t is missing value then
        set foundSeparators to foundSeparators + 1
      else if foundSeparators >= 4 then
        set end of results to (idx as text) & ":::" & t
      end if
    end repeat
    set AppleScript's text item delimiters to "|||"
    return results as text
  end tell
end tell
`;

function switchToTabScript(menuIndex: number): string {
  return `
tell application "Zed" to activate
tell application "System Events"
  tell process "Zed"
    set theMenu to menu 1 of menu bar item "Window" of menu bar 1
    click menu item ${menuIndex} of theMenu
  end tell
end tell
`;
}

interface Tab {
  name: string;
  project: string;
  file: string | null;
  menuIndex: number;
}

function parseTabEntry(entry: string): Tab {
  const [indexStr, name] = entry.split(":::");
  const menuIndex = parseInt(indexStr, 10);
  const parts = name.split(" — ");
  if (parts.length === 2) {
    return { name, project: parts[0], file: parts[1], menuIndex };
  }
  return { name, project: name, file: null, menuIndex };
}

async function fetchTabs(): Promise<Tab[]> {
  const result = await runAppleScript(LIST_TABS_SCRIPT);
  const entries = result.split("|||").filter(Boolean);
  if (entries.length === 0) {
    throw new Error("Zed not focused - using cached tabs");
  }
  return entries.map(parseTabEntry);
}

export default function Command() {
  const { isLoading, data: tabs, revalidate } = useCachedPromise(fetchTabs, [], {
    onError: () => {},
  });

  async function handleSwitchTab(tab: Tab) {
    try {
      await runAppleScript(switchToTabScript(tab.menuIndex));
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
          icon={{ source: Icon.Dot, tintColor: colorHash.hex(tab.project) }}
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
