---
kind: mdbase.contract
contract_type: record
id: tasknotes.task
version: 0.3.0-rc.3
name: TaskNotes task
description: Portable task data and behavior defined by tasknotes-spec 0.3.0-rc.3.
record_schema:
  dialect: json-schema-2020-12
  ref: ../_schemas/tasknotes/tasknotes-task.schema.json
binding_schema:
  dialect: json-schema-2020-12
  ref: ../_schemas/tasknotes/tasknotes-task-binding.schema.json
---

# TaskNotes task contract

Types implement this contract through `implements`; applications consume
the normalized contract view rather than assuming frontmatter names.
