---
kind: mdbase.type
name: task
version: 1
description: A task managed by TaskNotes.
match:
  where:
    tags:
      contains: task
schema:
  dialect: json-schema-2020-12
  value:
    $schema: https://json-schema.org/draft/2020-12/schema
    type: object
    additionalProperties: true
    properties:
      title:
        type: string
        minLength: 1
      status:
        enum:
          - none
          - open
          - in-progress
          - done
        default: open
      priority:
        enum:
          - none
          - low
          - normal
          - high
        default: normal
      due:
        anyOf:
          - type: string
            format: date
          - type: string
            format: date-time
      scheduled:
        anyOf:
          - type: string
            format: date
          - type: string
            format: date-time
      contexts:
        type: array
        items:
          type: string
      projects:
        type: array
        items:
          type: string
      attachments:
        type: array
        items:
          type: string
          minLength: 1
        uniqueItems: true
      timeEstimate:
        type: integer
        minimum: 0
      completedDate:
        type: string
        format: date
      dateCreated:
        type: string
        format: date-time
      dateModified:
        type: string
        format: date-time
      recurrence:
        type: string
      recurrence_anchor:
        enum:
          - scheduled
          - completion
        default: scheduled
      occurrence_materialization:
        enum:
          - manual
          - on_completion
          - rolling
        default: manual
      occurrence_next_trigger:
        enum:
          - completion
          - completion_or_skip
        default: completion
      occurrence_template:
        type: string
      occurrence_past_horizon:
        type: string
      occurrence_future_horizon:
        type: string
      recurrence_parent:
        type: string
      occurrence_date:
        type: string
        format: date
      tags:
        type: array
        items:
          type: string
      timeEntries:
        type: array
        items:
          type: object
          additionalProperties: false
          properties:
            startTime:
              type: string
              format: date-time
            endTime:
              type: string
              format: date-time
            description:
              type: string
            duration:
              type: integer
      reminders:
        type: array
        items:
          oneOf:
            - type: object
              required:
                - id
                - type
                - absoluteTime
              additionalProperties: false
              properties:
                id:
                  type: string
                type:
                  const: absolute
                description:
                  type: string
                absoluteTime:
                  type: string
                  format: date-time
            - type: object
              required:
                - id
                - type
                - relatedTo
                - offset
              additionalProperties: false
              properties:
                id:
                  type: string
                type:
                  const: relative
                description:
                  type: string
                relatedTo:
                  enum:
                    - due
                    - scheduled
                offset:
                  type: string
      blockedBy:
        type: array
        items:
          type: object
          additionalProperties: false
          properties:
            uid:
              type: string
            reltype:
              type: string
            gap:
              type: string
          required:
            - uid
      complete_instances:
        type: array
        items:
          type: string
          format: date
      skipped_instances:
        type: array
        items:
          type: string
          format: date
      icsEventId:
        type: array
        items:
          type: string
      googleCalendarEventId:
        type: string
      googleCalendarExceptionEventId:
        type: string
      googleCalendarExceptionOriginalScheduled:
        type: string
        format: date
      googleCalendarMovedOriginalDates:
        type: array
        items:
          type: string
          format: date
      tasknotes_manual_order:
        type: string
      uid:
        type: string
        minLength: 1
    allOf:
      - if:
          required:
            - status
          properties:
            status:
              enum:
                - done
          not:
            required:
              - recurrence
        then:
          required:
            - completedDate
    required:
      - status
      - dateCreated
collection:
  read_defaults:
    status: open
    priority: normal
    recurrence_anchor: scheduled
    occurrence_materialization: manual
    occurrence_next_trigger: completion
  links:
    projects[]:
      target_type: any
      validate_exists: false
    attachments[]:
      validate_exists: false
    occurrence_template:
      target_type: any
      validate_exists: false
    recurrence_parent:
      target_type: task
      validate_exists: false
    blockedBy[].uid:
      target_type: task
      validate_exists: false
  path:
    runtime: tasknotes
    template: "{{title}}"
    folder: TaskNotes/Tasks
    generated_by: tasknotes.filename.create
  display:
    name_field: title
  unique:
    - field: id
      scope: type
lifecycle:
  on_create:
    set:
      id:
        uuid: true
      dateCreated:
        now: true
      dateModified:
        now: true
  on_update:
    set:
      dateModified:
        now: true
implements:
  - contract: tasknotes.task
    version: 0.3.0-rc.3
    fields:
      id: uid
      title: title
      status: status
      priority: priority
      due: due
      scheduled: scheduled
      contexts: contexts
      projects: projects
      attachments: attachments
      timeEstimate: timeEstimate
      completedDate: completedDate
      dateCreated: dateCreated
      dateModified: dateModified
      recurrence: recurrence
      recurrenceAnchor: recurrence_anchor
      occurrenceMaterialization: occurrence_materialization
      occurrenceNextTrigger: occurrence_next_trigger
      occurrenceTemplate: occurrence_template
      occurrencePastHorizon: occurrence_past_horizon
      occurrenceFutureHorizon: occurrence_future_horizon
      recurrenceParent: recurrence_parent
      occurrenceDate: occurrence_date
      tags: tags
      timeEntries: timeEntries
      reminders: reminders
      blockedBy: blockedBy
      completeInstances: complete_instances
      skippedInstances: skipped_instances
      icsEventId: icsEventId
      googleCalendarEventId: googleCalendarEventId
      googleCalendarExceptionEventId: googleCalendarExceptionEventId
      googleCalendarExceptionOriginalScheduled: googleCalendarExceptionOriginalScheduled
      googleCalendarMovedOriginalDates: googleCalendarMovedOriginalDates
      sortOrder: tasknotes_manual_order
    binding:
      profiles:
        - core-lite
        - recurrence
        - templating
        - materialized-occurrences
        - extended
      capabilities:
        - dependencies
        - reminders
        - attachments
        - links
        - time-tracking
        - materialized-occurrences
        - archive
        - templating
      title:
        storage: filename
        filename_format: title
      status:
        values:
          - none
          - open
          - in-progress
          - done
        default: open
        completed_values:
          - done
        skipped_values: []
        definitions:
          - value: none
            label: None
            color: "#cccccc"
            is_completed: false
            is_skipped: false
            exclude_from_cycle: false
            order: 0
            auto_archive: false
            auto_archive_delay_minutes: 5
          - value: open
            label: Open
            color: "#808080"
            is_completed: false
            is_skipped: false
            exclude_from_cycle: false
            order: 1
            auto_archive: false
            auto_archive_delay_minutes: 5
          - value: in-progress
            label: In progress
            color: "#0066cc"
            is_completed: false
            is_skipped: false
            exclude_from_cycle: false
            order: 2
            auto_archive: false
            auto_archive_delay_minutes: 5
          - value: done
            label: Done
            color: "#00aa00"
            is_completed: true
            is_skipped: false
            exclude_from_cycle: false
            order: 3
            auto_archive: false
            auto_archive_delay_minutes: 5
      priority:
        values:
          - none
          - low
          - normal
          - high
        default: normal
        definitions:
          - value: none
            label: None
            color: "#cccccc"
            weight: 0
          - value: low
            label: Low
            color: "#00aa00"
            weight: 1
          - value: normal
            label: Normal
            color: "#ffaa00"
            weight: 2
          - value: high
            label: High
            color: "#ff0000"
            weight: 3
      recurrence:
        syntax: tasknotes
        maintain_due_date_offset: false
        reset_body_checkboxes: false
      occurrences:
        identity_roles:
          - recurrenceParent
          - occurrenceDate
        default_materialization: rolling
        default_next_trigger: completion
        past_horizon: P0D
        future_horizon: P90D
      links:
        accepted_formats:
          - wikilink
          - markdown
        write_format: wikilink
      archive:
        archived_tag: cold
        move_on_archive: false
        folder: TaskNotes/Archive
      time_tracking:
        auto_stop_on_complete: true
      nlp:
        triggers:
          - property_id: tags
            trigger: "#"
            enabled: true
          - property_id: contexts
            trigger: "@"
            enabled: true
          - property_id: projects
            trigger: +
            enabled: true
          - property_id: status
            trigger: "*"
            enabled: true
          - property_id: priority
            trigger: "!"
            enabled: false
      templating:
        enabled: false
        occurrence_enabled: false
x-tasknotes-generator:
  managed_fields:
    - attachments
    - blockedBy
    - complete_instances
    - completedDate
    - contexts
    - dateCreated
    - dateModified
    - due
    - googleCalendarEventId
    - googleCalendarExceptionEventId
    - googleCalendarExceptionOriginalScheduled
    - googleCalendarMovedOriginalDates
    - icsEventId
    - id
    - occurrence_date
    - occurrence_future_horizon
    - occurrence_materialization
    - occurrence_next_trigger
    - occurrence_past_horizon
    - occurrence_template
    - priority
    - projects
    - recurrence
    - recurrence_anchor
    - recurrence_parent
    - reminders
    - scheduled
    - skipped_instances
    - status
    - tags
    - tasknotes_manual_order
    - timeEntries
    - timeEstimate
    - title
---
# Task
