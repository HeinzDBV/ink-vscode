import { DefinitionProvider,Location,TextDocument, Position, ProviderResult} from "vscode";
import { getDefinitionByNameAndScope } from "../controllers/NodeController";

export class InkDivertDefinitionProvider implements DefinitionProvider 
{
    private static readonly divertRegex = /->\s*([\w.]+)/;

    public provideDefinition(document: TextDocument, position: Position): ProviderResult<Location> {
      try {
        const lineText = document.lineAt(position.line).text;
        const cursorPos = position.character;

        const match = InkDivertDefinitionProvider.divertRegex.exec(lineText.slice(0, cursorPos) + lineText.slice(cursorPos));
        if (!match) return;

        const [target] = match[1].split(".");
        return getDefinitionByNameAndScope(target, document.uri.fsPath, position.line);
      } catch (err) {
        console.error("Ink divert definition failed:", err);
        return;
      }
    }
}
