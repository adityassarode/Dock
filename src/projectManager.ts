import * as path from "path";
import * as vscode from "vscode";
import {
  detectLanguageFromFile,
  getWorkspaceRoot,
  isInsidePath,
} from "./utils";

export type DockOpenMode = "newWindow" | "currentWindow" | "addToWorkspace";

export interface DockProject {
  name: string;
  path: string;
  tags: string[];
  languages: string[];
  status: "active";
  createdAt: string;
}

interface DockIndex {
  projects: DockProject[];
}

export class ProjectManager {
  constructor(private readonly context: vscode.ExtensionContext) {}

  // -----------------------------
  // PUBLIC METHODS
  // -----------------------------

  public async getProjects(): Promise<DockProject[]> {
    const index = await this.readIndex();
    return index.projects;
  }

  public async registerProject(resourceUri?: vscode.Uri): Promise<void> {
    const root = getWorkspaceRoot();
    if (!root) {
      vscode.window.showWarningMessage(
        "Dock requires an open workspace folder.",
      );
      return;
    }

    let selectedUri = resourceUri;

    if (!selectedUri) {
      const selected = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: "Register to Dock",
        defaultUri: root.uri,
      });
      selectedUri = selected?.[0];
    }

    if (!selectedUri) return;

    const stat = await vscode.workspace.fs.stat(selectedUri);

    const projectRootUri =
      stat.type === vscode.FileType.File
        ? vscode.Uri.file(path.dirname(selectedUri.fsPath))
        : selectedUri;

    const defaultName = path.basename(projectRootUri.fsPath);

    const customName = await vscode.window.showInputBox({
      prompt: "Optional project name for Dock",
      value: defaultName,
      placeHolder: "Leave as-is to use folder name",
    });

    if (customName === undefined) return;

    let name = customName.trim() || defaultName;

    const index = await this.readIndex();
    const languages = await this.detectLanguagesForFolder(projectRootUri);

    // 🔹 Handle name conflict (different path, same name)
    const nameConflict = index.projects.find(
      (p) => p.name === name && p.path !== projectRootUri.fsPath,
    );

    if (nameConflict) {
      const action = await vscode.window.showQuickPick(
        [
          { label: "Rename", value: "rename" },
          { label: "Keep as Separate", value: "separate" },
          { label: "Merge with Existing", value: "merge" },
          { label: "Cancel", value: "cancel" },
        ],
        { placeHolder: `Project "${name}" already exists.` },
      );

      if (!action || action.value === "cancel") return;

      if (action.value === "rename") {
        const newName = await vscode.window.showInputBox({
          prompt: "Enter new project name",
        });
        if (!newName) return;
        name = newName.trim();
      }

      if (action.value === "merge") {
        nameConflict.languages = Array.from(
          new Set([...nameConflict.languages, ...languages]),
        ).sort();

        await this.writeIndex(index);

        vscode.window.showInformationMessage(
          `Merged into existing project "${nameConflict.name}".`,
        );
        return;
      }
      // if separate → continue
    }

    // 🔹 Check if same path already registered
    const existing = index.projects.find(
      (project) => project.path === projectRootUri.fsPath,
    );

    if (existing) {
      existing.name = name;
      existing.languages = Array.from(
        new Set([...existing.languages, ...languages]),
      ).sort();

      await this.writeIndex(index);

      vscode.window.showInformationMessage(`Dock updated project: ${name}`);
      return;
    }

    // 🔹 Add new project
    index.projects.push({
      name,
      path: projectRootUri.fsPath,
      tags: [],
      languages,
      status: "active",
      createdAt: new Date().toISOString(),
    });

    index.projects.sort((a, b) => a.name.localeCompare(b.name));

    await this.writeIndex(index);

    vscode.window.showInformationMessage(`Registered "${name}" in Dock.`);
  }

  public async createNewProject(): Promise<void> {
    const root = getWorkspaceRoot();
    if (!root) {
      vscode.window.showWarningMessage(
        "Dock requires an open workspace folder.",
      );
      return;
    }

    const folderName = await vscode.window.showInputBox({
      prompt: "Project Folder Name",
      placeHolder: "my-new-project",
      validateInput: (value) =>
        value.trim() ? undefined : "Project Folder Name is required.",
    });

    if (!folderName) return;

    const location = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: "Select location (defaults to workspace root)",
      defaultUri: root.uri,
    });

    const baseUri = location?.[0] ?? root.uri;
    const newFolderUri = vscode.Uri.joinPath(baseUri, folderName.trim());

    try {
      await vscode.workspace.fs.createDirectory(newFolderUri);
      vscode.window.showInformationMessage(
        `Created folder: ${newFolderUri.fsPath}`,
      );
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to create project folder: ${String(error)}`,
      );
    }
  }

  public async searchProjects(
    onSelect: (project: DockProject) => Promise<void>,
  ): Promise<void> {
    const projects = await this.getProjects();

    if (projects.length === 0) {
      vscode.window.showInformationMessage(
        "No projects are registered in Dock yet.",
      );
      return;
    }

    const picked = await vscode.window.showQuickPick(
      projects.map((project) => ({
        label: project.name,
        description: project.languages.join(", ") || "No languages detected",
        detail: project.path,
        project,
      })),
      {
        placeHolder: "Search by project name, languages, or path",
        matchOnDescription: true,
        matchOnDetail: true,
      },
    );

    if (picked) await onSelect(picked.project);
  }

  public async updateProjectMetadataForUri(uri: vscode.Uri): Promise<boolean> {
    const index = await this.readIndex();
    let changed = false;

    for (const project of index.projects) {
      if (!isInsidePath(uri.fsPath, project.path)) continue;

      const language = detectLanguageFromFile(uri);
      if (language && !project.languages.includes(language)) {
        project.languages.push(language);
        project.languages.sort();
        changed = true;
      }
    }

    if (changed) await this.writeIndex(index);

    return changed;
  }

  public async resolveOpenMode(): Promise<DockOpenMode> {
    const configuration = vscode.workspace.getConfiguration("dock");

    return configuration.get<DockOpenMode>("defaultOpenMode", "currentWindow");
  }

  // -----------------------------
  // PRIVATE HELPERS
  // -----------------------------

  private async detectLanguagesForFolder(
    folderUri: vscode.Uri,
  ): Promise<string[]> {
    const files = await vscode.workspace.findFiles(
      new vscode.RelativePattern(folderUri, "**/*"),
      new vscode.RelativePattern(
        folderUri,
        "**/{node_modules,.git,out,dist}/**",
      ),
      2000,
    );

    const languages = new Set<string>();

    for (const file of files) {
      const language = detectLanguageFromFile(file);
      if (language) languages.add(language);
    }

    return Array.from(languages).sort();
  }

  private async readIndex(): Promise<DockIndex> {
    const stored = this.context.globalState.get<DockIndex>("dockProjects");

    return stored ?? { projects: [] };
  }

  private async writeIndex(index: DockIndex): Promise<void> {
    await this.context.globalState.update("dockProjects", index);
  }
  public async saveProjects(projects: DockProject[]): Promise<void> {
    await this.context.globalState.update("dockProjects", { projects });
  }
}



