---
type: workflow
schemaVersion: 1
id: workflows-27-timeout
name: Workflows 27 timeout
enabled: true
triggers:
  - id: manual
    type: manual
steps:
  - id: reschedule
    type: task.reschedule
    forEach:
      items: "{{event.paths}}"
    input:
      task: "{{item}}"
      date: "2026-11-23"
run:
  mode: sequential
  concurrency:
    group: workflow
    policy: skip
  onError: stop
---
