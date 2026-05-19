import { readFileSync, readdirSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import ts from "typescript";

const repoRoot = resolve(import.meta.dirname, "..");
const srcRoot = resolve(repoRoot, "src");

const CONSOLE_METHODS = new Set(["debug", "error", "info", "log", "warn"]);
const LOGGER_METHODS_REQUIRING_METADATA = new Set(["error", "warn"]);
const TIMER_AND_DOM_GLOBALS = new Set([
	"Blob",
	"document",
	"Document",
	"HTMLElement",
	"requestAnimationFrame",
	"setInterval",
	"setTimeout",
	"window",
	"Window",
]);
const NETWORK_GLOBALS = new Set(["fetch", "requestUrl", "XMLHttpRequest"]);
const VAULT_WRITE_METHODS = new Set([
	"append",
	"create",
	"createBinary",
	"delete",
	"modify",
	"modifyBinary",
	"processFrontMatter",
	"rename",
	"trash",
]);

const pureModulePatterns = [
	/^src\/bases\/.*(?:Planning|Conversion|Defaults|Signature|Snapshot|Properties|Export|Value|Values|State)\.ts$/,
	/^src\/services\/filter-service\/.*\.ts$/,
	/^src\/services\/task-service\/.*Planning\.ts$/,
	/^src\/services\/task-service\/taskTitleSanitizer\.ts$/,
	/^src\/utils\/(?:dateUtils|filenameGenerator|folderTemplateProcessor|linkUtils|projectMetadataResolver|stringSplit|templateProcessor)\.ts$/,
];

const domainModulePatterns = [
	/^src\/core\/.*\.ts$/,
	/^src\/services\/.*\.ts$/,
	/^src\/utils\/.*\.ts$/,
	/^src\/bootstrap\/.*\.ts$/,
];

const uiBoundaryPatterns = [
	/^src\/api\/.*\.ts$/,
	/^src\/bases\/.*\.ts$/,
	/^src\/commands\/.*\.ts$/,
	/^src\/components\/.*\.ts$/,
	/^src\/editor\/.*\.ts$/,
	/^src\/main\.ts$/,
	/^src\/modals\/.*\.ts$/,
	/^src\/settings\/.*\.ts$/,
	/^src\/ui\/.*\.ts$/,
	/^src\/views\/.*\.ts$/,
];

const vaultWriteAllowedPatterns = [
	/^src\/api\/.*\.ts$/,
	/^src\/bases\/.*\.ts$/,
	/^src\/bootstrap\/.*\.ts$/,
	/^src\/core\/VaultMutationService\.ts$/,
	/^src\/main\.ts$/,
	/^src\/services\/(?:AutoArchiveService|ICSNoteService|MdbaseSpecService|TaskService|VaultMutationService|ViewStateManager)\.ts$/,
	/^src\/services\/task-service\/(?:TaskCreationService|TaskUpdateService|taskPropertyChangeSideEffects)\.ts$/,
	/^src\/settings\/settingsPersistence\.ts$/,
	/^src\/utils\/TaskManager\.ts$/,
];

const networkAllowedPatterns = [
	/^src\/api\/.*\.ts$/,
	/^src\/services\/(?:GoogleCalendarService|HTTPAPIService|ICSSubscriptionService|MCPService|MicrosoftCalendarService|OAuthService)\.ts$/,
];

const pluginImportAllowedPatterns = [
	/^src\/api\/.*\.ts$/,
	/^src\/bases\/(?:BasesViewBase|CalendarView|KanbanView|MiniCalendarView|TaskListView|registration)\.ts$/,
	/^src\/bootstrap\/.*\.ts$/,
	/^src\/commands\/.*\.ts$/,
	/^src\/components\/.*\.ts$/,
	/^src\/editor\/.*\.ts$/,
	/^src\/main\.ts$/,
	/^src\/modals\/.*\.ts$/,
	/^src\/services\/(?:AutoArchiveService|AutoExportService|CalendarProvider|FilterService|GoogleCalendarService|ICSNoteService|ICSSubscriptionService|InstantTaskConvertService|MCPService|MdbaseSpecService|MicrosoftCalendarService|NotificationService|OAuthService|PomodoroService|ProjectSubtasksService|SettingsLifecycleService|StatusBarService|TaskActionCoordinator|TaskCalendarSyncService|TaskSelectionService|TaskService|TriggerConfigService|ViewPerformanceService|ViewStateManager|WorkspaceNavigationService)\.ts$/,
	/^src\/services\/task-service\/(?:TaskCreationService|TaskUpdateService|taskPropertyChangeSideEffects)\.ts$/,
	/^src\/settings\/.*\.ts$/,
	/^src\/ui\/.*\.ts$/,
	/^src\/views\/.*\.ts$/,
];

const lowerLayerPatterns = [
	/^src\/core\/.*\.ts$/,
	/^src\/services\/filter-service\/.*\.ts$/,
	/^src\/services\/task-service\/.*Planning\.ts$/,
	/^src\/utils\/.*\.ts$/,
];

const forbiddenUpperLayerImportPattern = /^src\/(?:bases|components|editor|modals|settings|ui|views)\//;
const servicesLayerPattern = /^src\/services\/.*\.ts$/;
const utilsLayerPattern = /^src\/utils\/.*\.ts$/;
const forbiddenServicePresentationImportPattern = /^src\/(?:components|modals|ui|views)\//;
const forbiddenUtilsServiceImportPattern = /^src\/services\//;

const ignoredPaths = new Set([
	"src/utils/tasknotesLogger.ts",
]);

const violations = [];

function listTsFiles(dir) {
	const entries = readdirSync(dir, { withFileTypes: true });
	const files = [];
	for (const entry of entries) {
		const fullPath = resolve(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...listTsFiles(fullPath));
		} else if (entry.isFile() && entry.name.endsWith(".ts")) {
			files.push(fullPath);
		}
	}
	return files;
}

function toRepoPath(filePath) {
	return relative(repoRoot, filePath).split(sep).join("/");
}

function matchesAny(path, patterns) {
	return patterns.some((pattern) => pattern.test(path));
}

function addViolation(file, node, rule, message) {
	const { line, character } = file.source.getLineAndCharacterOfPosition(node.getStart(file.source));
	violations.push({
		path: file.path,
		line: line + 1,
		column: character + 1,
		rule,
		message,
	});
}

function isIdentifierNamed(node, name) {
	return ts.isIdentifier(node) && node.text === name;
}

function isPropertyAccessNamed(node, objectName, propertyNames) {
	return (
		ts.isPropertyAccessExpression(node) &&
		isIdentifierNamed(node.expression, objectName) &&
		propertyNames.has(node.name.text)
	);
}

function isLoggerCallRequiringMetadata(node) {
	return (
		ts.isPropertyAccessExpression(node.expression) &&
		LOGGER_METHODS_REQUIRING_METADATA.has(node.expression.name.text) &&
		/Logger$/u.test(node.expression.expression.getText())
	);
}

function hasMetadataCategoryAndOperation(argument) {
	if (!argument || !ts.isObjectLiteralExpression(argument)) {
		return false;
	}

	const names = new Set();
	for (const property of argument.properties) {
		if (ts.isPropertyAssignment(property)) {
			const name = property.name;
			if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
				names.add(name.text);
			}
		}
	}

	return names.has("category") && names.has("operation");
}

function getImportTargetPath(currentPath, moduleSpecifier) {
	if (!moduleSpecifier.startsWith(".")) {
		return moduleSpecifier;
	}

	const currentDir = currentPath.split("/").slice(0, -1).join("/");
	const segments = `${currentDir}/${moduleSpecifier}`.split("/");
	const resolved = [];
	for (const segment of segments) {
		if (!segment || segment === ".") {
			continue;
		}
		if (segment === "..") {
			resolved.pop();
		} else {
			resolved.push(segment);
		}
	}
	return resolved.join("/").replace(/\.(ts|js)$/u, "");
}

function isPluginImport(moduleSpecifier) {
	return /(?:^|\/)main$/u.test(moduleSpecifier) || moduleSpecifier === "../main";
}

function isTypeOnlyObsidianImport(node) {
	if (!ts.isImportDeclaration(node)) {
		return false;
	}
	if (node.importClause?.isTypeOnly) {
		return true;
	}
	const namedBindings = node.importClause?.namedBindings;
	if (namedBindings && ts.isNamedImports(namedBindings)) {
		return namedBindings.elements.every((element) => element.isTypeOnly);
	}
	return false;
}

function inspectFile(path) {
	const text = readFileSync(path, "utf8");
	const repoPath = toRepoPath(path);
	const source = ts.createSourceFile(repoPath, text, ts.ScriptTarget.Latest, true);
	const file = { path: repoPath, source };
	const isIgnored = ignoredPaths.has(repoPath);
	const isPureModule = matchesAny(repoPath, pureModulePatterns);
	const isDomainModule = matchesAny(repoPath, domainModulePatterns);
	const isUiBoundary = matchesAny(repoPath, uiBoundaryPatterns);
	const isVaultWriteAllowed = matchesAny(repoPath, vaultWriteAllowedPatterns);
	const isNetworkAllowed = matchesAny(repoPath, networkAllowedPatterns);
	const isPluginImportAllowed = matchesAny(repoPath, pluginImportAllowedPatterns);
	const isLowerLayer = matchesAny(repoPath, lowerLayerPatterns);
	const isServiceLayer = servicesLayerPattern.test(repoPath);
	const isUtilsLayer = utilsLayerPattern.test(repoPath);

	function visit(node) {
		if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
			const moduleSpecifier = node.moduleSpecifier.text;
			const target = getImportTargetPath(repoPath, moduleSpecifier);

			if (isPureModule && isPluginImport(moduleSpecifier) && !isPluginImportAllowed) {
				addViolation(
					file,
					node,
					"pure-no-plugin-import",
					"Pure modules must not import TaskNotesPlugin/main."
				);
			}

			if (isPureModule && moduleSpecifier === "obsidian" && !isTypeOnlyObsidianImport(node)) {
				addViolation(
					file,
					node,
					"pure-no-obsidian-runtime-import",
					"Pure modules must not import Obsidian runtime values."
				);
			}

			if (isLowerLayer && forbiddenUpperLayerImportPattern.test(target)) {
				addViolation(
					file,
					node,
					"no-upward-layer-import",
					"Core, utility, and pure service modules must not import UI/view/modal layers."
				);
			}

			if (isUtilsLayer && forbiddenUtilsServiceImportPattern.test(target)) {
				addViolation(
					file,
					node,
					"utils-no-services-import",
					"Utility modules must not import service-layer modules."
				);
			}

			if (isServiceLayer && forbiddenServicePresentationImportPattern.test(target)) {
				addViolation(
					file,
					node,
					"services-no-presentation-import",
					"Service modules must not import UI, component, modal, or view modules."
				);
			}
		}

		if (ts.isCallExpression(node)) {
			if (
				!isIgnored &&
				isPropertyAccessNamed(node.expression, "console", CONSOLE_METHODS)
			) {
				addViolation(
					file,
					node,
					"no-raw-console",
					"Use createTaskNotesLogger instead of raw console.* in production src."
				);
			}

			if (isLoggerCallRequiringMetadata(node) && !hasMetadataCategoryAndOperation(node.arguments[1])) {
				addViolation(
					file,
					node,
					"logger-warn-error-metadata",
					"logger.warn/error calls must include metadata with category and operation."
				);
			}

			if (
				isPureModule &&
				ts.isIdentifier(node.expression) &&
				(TIMER_AND_DOM_GLOBALS.has(node.expression.text) || NETWORK_GLOBALS.has(node.expression.text))
			) {
				addViolation(
					file,
					node,
					"pure-no-runtime-globals",
					"Pure modules must not call DOM, timer, or network globals."
				);
			}

			if (
				!isNetworkAllowed &&
				ts.isIdentifier(node.expression) &&
				NETWORK_GLOBALS.has(node.expression.text)
			) {
				addViolation(
					file,
					node,
					"no-network-outside-provider",
					"Network calls belong in provider/API/integration layers."
				);
			}

			if (isServiceLayer && isIdentifierNamed(node.expression, "showNotice")) {
				addViolation(
					file,
					node,
					"services-no-show-notice",
					"Service modules must return outcomes or emit events instead of showing notices."
				);
			}

			if (ts.isPropertyAccessExpression(node.expression)) {
				const methodName = node.expression.name.text;
				if (
					isPureModule &&
					ts.isIdentifier(node.expression.expression) &&
					TIMER_AND_DOM_GLOBALS.has(node.expression.expression.text)
				) {
					addViolation(
						file,
						node,
						"pure-no-runtime-globals",
						"Pure modules must not call DOM, timer, or network globals."
					);
				}
				if (!isVaultWriteAllowed && VAULT_WRITE_METHODS.has(methodName)) {
					const expressionText = node.expression.expression.getText(source);
					if (/\b(?:vault|fileManager)\b/u.test(expressionText)) {
						addViolation(
							file,
							node,
							"no-vault-write-outside-boundary",
							"Vault/frontmatter writes belong in approved mutation or persistence boundaries."
						);
					}
				}
			}
		}

		if (ts.isNewExpression(node) && isIdentifierNamed(node.expression, "Notice")) {
			if (isDomainModule && !isUiBoundary) {
				addViolation(
					file,
					node,
					"no-notice-in-domain",
					"Domain, persistence, and planning modules must not show Obsidian notices directly."
				);
			}
			if (isPureModule) {
				addViolation(
					file,
					node,
					"pure-no-notice",
					"Pure modules must not show Obsidian notices directly."
				);
			}
		}

		ts.forEachChild(node, visit);
	}

	visit(source);
}

for (const file of listTsFiles(srcRoot)) {
	inspectFile(file);
}

violations.sort((a, b) =>
	a.path.localeCompare(b.path) || a.line - b.line || a.column - b.column
);

if (violations.length > 0) {
	console.error(`Architecture conformance failed with ${violations.length} violation(s):`);
	for (const violation of violations) {
		console.error(
			`${violation.path}:${violation.line}:${violation.column} ${violation.rule} - ${violation.message}`
		);
	}
	process.exit(1);
}

console.log("Architecture conformance passed.");
