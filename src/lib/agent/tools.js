/**
 * Agent Tool Definitions — Claude tool-use schema for the BOXX admin agent.
 * Each tool maps to an existing admin API action.
 */

export const AGENT_TOOLS = [
  // ── Schedule ──────────────────────────────────────
  {
    name: 'create_class',
    description: 'Create a single class on the schedule. Requires a class type, instructor, date/time, and capacity.',
    input_schema: {
      type: 'object',
      properties: {
        class_type: { type: 'string', description: 'Name of the class type (e.g. "Boxing Fundamentals"). Must match an existing class type.' },
        instructor: { type: 'string', description: 'Name of the instructor. Must match an existing instructor.' },
        date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
        start_time: { type: 'string', description: 'Start time in HH:MM format (24h), Bangkok timezone' },
        duration_mins: { type: 'number', description: 'Duration in minutes. If not specified, uses the class type default.' },
        capacity: { type: 'number', description: 'Max number of attendees. Default: 6' },
        notes: { type: 'string', description: 'Optional notes for the class' },
      },
      required: ['class_type', 'instructor', 'date', 'start_time'],
    },
  },
  {
    name: 'create_recurring_classes',
    description: 'Create recurring classes on the schedule. Specify days of week and number of weeks.',
    input_schema: {
      type: 'object',
      properties: {
        class_type: { type: 'string', description: 'Name of the class type' },
        instructor: { type: 'string', description: 'Name of the instructor' },
        start_time: { type: 'string', description: 'Start time in HH:MM format (24h)' },
        duration_mins: { type: 'number', description: 'Duration in minutes' },
        capacity: { type: 'number', description: 'Max attendees. Default: 6' },
        days: {
          type: 'array',
          items: { type: 'string', enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] },
          description: 'Days of the week to schedule',
        },
        weeks: { type: 'number', description: 'Number of weeks to generate. Default: 4' },
        start_date: { type: 'string', description: 'First date to start generating from (YYYY-MM-DD). Default: next occurrence.' },
        notes: { type: 'string', description: 'Optional notes' },
      },
      required: ['class_type', 'instructor', 'start_time', 'days'],
    },
  },
  {
    name: 'cancel_class',
    description: 'Cancel a specific scheduled class. Refunds credits and notifies booked members.',
    input_schema: {
      type: 'object',
      properties: {
        class_type: { type: 'string', description: 'Name of the class type to find' },
        date: { type: 'string', description: 'Date of the class (YYYY-MM-DD)' },
        start_time: { type: 'string', description: 'Start time (HH:MM) to disambiguate if multiple classes that day' },
        cancel_all_recurring: { type: 'boolean', description: 'If true, cancels all future recurring instances too' },
      },
      required: ['class_type', 'date'],
    },
  },
  {
    name: 'get_schedule',
    description: 'View scheduled classes for a date range. Returns class details, bookings, and roster.',
    input_schema: {
      type: 'object',
      properties: {
        start_date: { type: 'string', description: 'Start date (YYYY-MM-DD). Default: today' },
        end_date: { type: 'string', description: 'End date (YYYY-MM-DD). Default: 7 days from start' },
      },
    },
  },

  {
    name: 'delete_class',
    description: 'Permanently delete a cancelled class from the schedule. The class must already be cancelled before it can be deleted.',
    input_schema: {
      type: 'object',
      properties: {
        class_type: { type: 'string', description: 'Name of the class type to find' },
        date: { type: 'string', description: 'Date of the class (YYYY-MM-DD)' },
        start_time: { type: 'string', description: 'Start time (HH:MM) to disambiguate if multiple classes that day' },
      },
      required: ['class_type', 'date'],
    },
  },

  // ── Roster ────────────────────────────────────────
  {
    name: 'add_member_to_class',
    description: 'Add a member to a class roster. Bypasses capacity and credit checks (admin override).',
    input_schema: {
      type: 'object',
      properties: {
        member: { type: 'string', description: 'Member name or email to add' },
        class_type: { type: 'string', description: 'Class type name' },
        date: { type: 'string', description: 'Date of the class (YYYY-MM-DD)' },
        start_time: { type: 'string', description: 'Start time (HH:MM) to disambiguate' },
      },
      required: ['member', 'class_type', 'date'],
    },
  },

  // ── Members ───────────────────────────────────────
  {
    name: 'search_members',
    description: 'Search members by name or email. Returns member list with credit and booking info.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Name or email to search for' },
        has_credits: { type: 'string', enum: ['yes', 'no'], description: 'Filter by whether member has active credits' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_member_detail',
    description: 'Get full detail for a specific member: bookings, credits, stats.',
    input_schema: {
      type: 'object',
      properties: {
        member: { type: 'string', description: 'Member name or email' },
      },
      required: ['member'],
    },
  },
  {
    name: 'grant_credits',
    description: 'Grant a free class pack to a member (comp/courtesy credits).',
    input_schema: {
      type: 'object',
      properties: {
        member: { type: 'string', description: 'Member name or email' },
        pack: { type: 'string', description: 'Name of the class pack to grant' },
      },
      required: ['member', 'pack'],
    },
  },

  // ── Instructors ─────────────────────────────────────
  {
    name: 'create_instructor',
    description: 'Add a new instructor to the studio.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Instructor name' },
        bio: { type: 'string', description: 'Short bio (optional)' },
      },
      required: ['name'],
    },
  },
  {
    name: 'update_instructor',
    description: 'Update an existing instructor (name, bio, or active status).',
    input_schema: {
      type: 'object',
      properties: {
        instructor: { type: 'string', description: 'Instructor name to find' },
        name: { type: 'string', description: 'New name (optional)' },
        bio: { type: 'string', description: 'New bio (optional)' },
        active: { type: 'boolean', description: 'Set active/inactive (optional)' },
      },
      required: ['instructor'],
    },
  },

  // ── Communications ────────────────────────────────
  {
    name: 'send_email',
    description: 'Send a direct email to a registered member.',
    input_schema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Member name or email' },
        subject: { type: 'string', description: 'Email subject line' },
        body: { type: 'string', description: 'Email body text' },
      },
      required: ['to', 'subject', 'body'],
    },
  },

  // ── Dashboard ─────────────────────────────────────
  {
    name: 'get_dashboard',
    description: 'Get dashboard overview: stats, trends, today\'s classes, recent activity.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
]
