---
kind: mdbase.type
name: second-task
version: 4
description: A task managed by TaskNotes.
match:
  where:
    tags:
      contains: second
schema:
  dialect: json-schema-2020-12
  value:
    $schema: https://json-schema.org/draft/2020-12/schema
    additionalProperties: true
    allOf:
      - if:
          not:
            required:
              - recurrence
          properties:
            status:
              enum:
                - done
          required:
            - status
        then:
          required:
            - completedDate
    properties:
      assignees:
        items:
          minLength: 1
          pattern: \S
          type: string
        type: array
        uniqueItems: true
      attachments:
        items:
          minLength: 1
          type: string
        type: array
        uniqueItems: true
      blockedBy:
        items:
          additionalProperties: false
          properties:
            gap:
              type: string
            reltype:
              type: string
            uid:
              type: string
          required:
            - uid
          type: object
        type: array
      complete_instances:
        items:
          format: date
          type: string
        type: array
      completedDate:
        format: date
        type: string
      contexts:
        items:
          type: string
        type: array
      dateCreated:
        format: date-time
        type: string
      dateModified:
        format: date-time
        type: string
      due:
        anyOf:
          - format: date
            type: string
          - format: date-time
            type: string
      googleCalendarEventId:
        type: string
      googleCalendarExceptionEventId:
        type: string
      googleCalendarExceptionOriginalScheduled:
        format: date
        type: string
      googleCalendarMovedOriginalDates:
        items:
          format: date
          type: string
        type: array
      icsEventId:
        items:
          type: string
        type: array
      id:
        minLength: 1
        type: string
      occurrence_date:
        format: date
        type: string
      occurrence_future_horizon:
        type: string
      occurrence_materialization:
        default: manual
        enum:
          - manual
          - on_completion
          - rolling
      occurrence_next_trigger:
        default: completion
        enum:
          - completion
          - completion_or_skip
      occurrence_past_horizon:
        type: string
      occurrence_template:
        type: string
      priority:
        default: normal
        enum:
          - none
          - low
          - normal
          - high
      projects:
        items:
          type: string
        type: array
      recurrence:
        type: string
      recurrence_anchor:
        default: scheduled
        enum:
          - scheduled
          - completion
      recurrence_parent:
        type: string
      reminders:
        items:
          oneOf:
            - additionalProperties: false
              properties:
                absoluteTime:
                  format: date-time
                  type: string
                description:
                  type: string
                id:
                  type: string
                type:
                  const: absolute
              required:
                - id
                - type
                - absoluteTime
              type: object
            - additionalProperties: false
              properties:
                description:
                  type: string
                id:
                  type: string
                offset:
                  type: string
                relatedTo:
                  enum:
                    - due
                    - scheduled
                type:
                  const: relative
              required:
                - id
                - type
                - relatedTo
                - offset
              type: object
        type: array
      scheduled:
        anyOf:
          - format: date
            type: string
          - format: date-time
            type: string
      skipped_instances:
        items:
          format: date
          type: string
        type: array
      status:
        default: open
        enum:
          - none
          - open
          - in-progress
          - done
          - cancelled
      tags:
        items:
          type: string
        type: array
      tasknotes_manual_order:
        type: string
      timeEntries:
        items:
          additionalProperties: false
          properties:
            description:
              type: string
            duration:
              type: integer
            endTime:
              format: date-time
              type: string
            startTime:
              format: date-time
              type: string
          type: object
        type: array
      timeEstimate:
        minimum: 0
        type: integer
      title:
        minLength: 1
        type: string
    required:
      - title
      - status
      - dateCreated
    type: object
collection:
  display:
    name_field: title
  links:
    assignees[]:
      validate_exists: false
    attachments[]:
      validate_exists: false
    blockedBy[].uid:
      target_type: task
      validate_exists: false
    occurrence_template:
      target_type: any
      validate_exists: false
    projects[]:
      target_type: any
      validate_exists: false
    recurrence_parent:
      target_type: task
      validate_exists: false
  path:
    folder: tasks
    generated_by: tasknotes.filename.create
    runtime: tasknotes
    template: "{{zettel}}"
  read_defaults:
    occurrence_materialization: manual
    occurrence_next_trigger: completion
    priority: normal
    recurrence_anchor: scheduled
    status: open
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
  - binding:
      archive:
        archived_tag: archived
        move_on_archive: false
      capabilities:
        - dependencies
        - reminders
        - attachments
        - links
        - time-tracking
        - materialized-occurrences
        - archive
        - templating
      links:
        accepted_formats:
          - wikilink
          - markdown
        write_format: wikilink
      occurrences:
        default_materialization: manual
        default_next_trigger: completion
        future_horizon: P14D
        identity_roles:
          - recurrenceParent
          - occurrenceDate
        past_horizon: P0D
      priority:
        default: normal
        definitions:
          - color: "#94a3b8"
            label: None
            value: none
            weight: 0
          - color: "#3b82f6"
            label: Low
            value: low
            weight: 1
          - color: "#f59e0b"
            label: Normal
            value: normal
            weight: 2
          - color: "#ef4444"
            label: High
            value: high
            weight: 3
        values:
          - none
          - low
          - normal
          - high
      profiles:
        - core-lite
        - recurrence
        - materialized-occurrences
      recurrence:
        maintain_due_date_offset: true
        reset_body_checkboxes: false
        syntax: tasknotes
      status:
        completed_values:
          - done
        default: open
        default_skipped: cancelled
        definitions:
          - auto_archive: false
            auto_archive_delay_minutes: 5
            color: "#94a3b8"
            exclude_from_cycle: false
            is_completed: false
            is_skipped: false
            label: None
            order: 0
            value: none
          - auto_archive: false
            auto_archive_delay_minutes: 5
            color: "#64748b"
            exclude_from_cycle: false
            is_completed: false
            is_skipped: false
            label: Open
            order: 1
            value: open
          - auto_archive: false
            auto_archive_delay_minutes: 5
            color: "#3b82f6"
            exclude_from_cycle: false
            is_completed: false
            is_skipped: false
            label: In progress
            order: 2
            value: in-progress
          - auto_archive: false
            auto_archive_delay_minutes: 5
            color: "#22c55e"
            exclude_from_cycle: false
            is_completed: true
            is_skipped: false
            label: Done
            order: 3
            value: done
          - auto_archive: false
            auto_archive_delay_minutes: 5
            color: "#94a3b8"
            exclude_from_cycle: true
            is_completed: false
            is_skipped: true
            label: Cancelled
            order: 4
            value: cancelled
        skipped_values:
          - cancelled
        values:
          - none
          - open
          - in-progress
          - done
          - cancelled
      templating:
        enabled: false
        occurrence_enabled: false
      time_tracking:
        auto_stop_on_complete: false
      title:
        filename_format: zettel
        storage: frontmatter
    contract: tasknotes.task
    fields:
      assignees: assignees
      attachments: attachments
      blockedBy: blockedBy
      completeInstances: complete_instances
      completedDate: completedDate
      contexts: contexts
      dateCreated: dateCreated
      dateModified: dateModified
      due: due
      googleCalendarEventId: googleCalendarEventId
      googleCalendarExceptionEventId: googleCalendarExceptionEventId
      googleCalendarExceptionOriginalScheduled: googleCalendarExceptionOriginalScheduled
      googleCalendarMovedOriginalDates: googleCalendarMovedOriginalDates
      icsEventId: icsEventId
      id: id
      occurrenceDate: occurrence_date
      occurrenceFutureHorizon: occurrence_future_horizon
      occurrenceMaterialization: occurrence_materialization
      occurrenceNextTrigger: occurrence_next_trigger
      occurrencePastHorizon: occurrence_past_horizon
      occurrenceTemplate: occurrence_template
      priority: priority
      projects: projects
      recurrence: recurrence
      recurrenceAnchor: recurrence_anchor
      recurrenceParent: recurrence_parent
      reminders: reminders
      scheduled: scheduled
      skippedInstances: skipped_instances
      sortOrder: tasknotes_manual_order
      status: status
      tags: tags
      timeEntries: timeEntries
      timeEstimate: timeEstimate
      title: title
    version: 0.3.0-rc.5
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
