const fs = require("fs");
const p = "src/core/recurrence.ts";
let c = fs.readFileSync(p, "utf8");
const eol = c.includes("\r\n") ? "\r\n" : "\n";
const lines = [
	"function normalizeMinutePrecisionDateInputs<T extends { scheduled?: string; dateCreated?: string }>(",
	"\ttask: T",
	"): T {",
	"\tconst scheduled = normalizeMinutePrecisionDateTime(task.scheduled);",
	"\tconst dateCreated = normalizeMinutePrecisionDateTime(task.dateCreated);",
	"",
	"\tif (scheduled === task.scheduled && dateCreated === task.dateCreated) {",
	"\t\treturn task;",
	"\t}",
	"",
	"\treturn {",
	"\t\t...task,",
	"\t\tscheduled,",
	"\t\tdateCreated,",
	"\t};",
	"}",
];
const block = lines.join(eol) + eol;
const doubled = block + block;
const needle = "function normalizeMinutePrecisionDateInputs";
if (c.includes(doubled)) {
	c = c.replace(doubled, block);
	fs.writeFileSync(p, c);
	console.log("removed dup; copies now:", c.split(needle).length - 1);
} else {
	console.log("doubled NOT found; copies:", c.split(needle).length - 1);
}