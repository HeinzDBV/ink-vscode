import { DefinitionProvider, Location, TextDocument, Position, ProviderResult, Uri} from "vscode";
import { getFunctionDefinitionByName } from "../controllers/FunctionController";

export class InkFunctionDefinitionProvider implements DefinitionProvider {
    private static readonly functionCallRegex = /\b([\w]+)\s*/;

    public provideDefinition(document: TextDocument, position: Position): ProviderResult<Location> 
    {
      try {
        const lineText = document.lineAt(position.line).text;

        if (!lineText.trimStart().startsWith("~")) return;

        const match = InkFunctionDefinitionProvider.functionCallRegex.exec(lineText);
        if (!match) return;

        const functionName = match[1];
        const result = getFunctionDefinitionByName(functionName, document.uri.fsPath);
        if (!result) return;

        return new Location(Uri.file(result.filePath), new Position(result.line, 0));
      } catch (err) {
        console.error("Ink function definition failed:", err);
        return;
      }
    }
}

