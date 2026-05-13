import type { Tool } from '@modelcontextprotocol/sdk/types.js'

export const ALL_TOOLS: Tool[] = [
  // Posts
  {
    name: 'list-posts',
    description: 'List posts with optional filters by brand, status, limit, and page.',
    inputSchema: {
      type: 'object',
      properties: {
        brandSlug: { type: 'string', description: 'Filter by brand slug' },
        status: {
          type: 'string',
          enum: ['draft', 'scheduled', 'published', 'failed'],
          description: 'Filter by post status',
        },
        limit: { type: 'number', description: 'Max results per page (default 20)' },
        page: { type: 'number', description: 'Page number (default 1)' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get-post',
    description: 'Get a post by its ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Post ID' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'create-post',
    description: 'Create a new post draft for a brand on one or more platforms.',
    inputSchema: {
      type: 'object',
      properties: {
        brandSlug: { type: 'string', description: 'Brand slug to post under' },
        text: { type: 'string', description: 'Post text content' },
        platforms: {
          type: 'string',
          description: 'Comma-separated platform list (e.g. x,linkedin)',
        },
        scheduledAt: {
          type: 'string',
          description: 'ISO 8601 datetime to schedule the post',
        },
      },
      required: ['brandSlug', 'text', 'platforms'],
      additionalProperties: false,
    },
  },
  {
    name: 'update-post',
    description: 'Update the text, platforms, or scheduled time of an existing post.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Post ID' },
        text: { type: 'string', description: 'New post text' },
        platforms: { type: 'string', description: 'Comma-separated new platform list' },
        scheduledAt: { type: 'string', description: 'New ISO 8601 scheduled datetime' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete-post',
    description: 'Permanently delete a post by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Post ID to delete' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'publish-post',
    description: 'Immediately publish a post to all its platforms.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Post ID to publish' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'schedule-post',
    description: 'Schedule a post to be published at a specific date and time.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Post ID to schedule' },
        scheduledAt: { type: 'string', description: 'ISO 8601 datetime for publishing' },
      },
      required: ['id', 'scheduledAt'],
      additionalProperties: false,
    },
  },
  {
    name: 'retry-post',
    description: 'Retry publishing a failed post.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Post ID to retry' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'rewrite-post',
    description: 'AI-rewrite the text of a post.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Post ID to rewrite' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'score-post',
    description: 'Score a post with AI feedback and return a numeric score with explanation.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Post ID to score' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },

  // Brands
  {
    name: 'list-brands',
    description: 'List all brands in the workspace.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'get-brand',
    description: 'Get a brand by its slug.',
    inputSchema: {
      type: 'object',
      properties: {
        brandSlug: { type: 'string', description: 'Brand slug' },
      },
      required: ['brandSlug'],
      additionalProperties: false,
    },
  },
  {
    name: 'create-brand',
    description: 'Create a new brand in the workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Brand display name' },
        timezone: { type: 'string', description: 'IANA timezone (e.g. America/New_York)' },
      },
      required: ['name'],
      additionalProperties: false,
    },
  },
  {
    name: 'update-brand',
    description: 'Update a brand name or timezone.',
    inputSchema: {
      type: 'object',
      properties: {
        brandSlug: { type: 'string', description: 'Brand slug to update' },
        name: { type: 'string', description: 'New display name' },
        timezone: { type: 'string', description: 'New IANA timezone' },
      },
      required: ['brandSlug'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete-brand',
    description: 'Permanently delete a brand by slug.',
    inputSchema: {
      type: 'object',
      properties: {
        brandSlug: { type: 'string', description: 'Brand slug to delete' },
      },
      required: ['brandSlug'],
      additionalProperties: false,
    },
  },
  {
    name: 'brand-auth-status',
    description: 'Show the platform connection status for a brand.',
    inputSchema: {
      type: 'object',
      properties: {
        brandSlug: { type: 'string', description: 'Brand slug' },
      },
      required: ['brandSlug'],
      additionalProperties: false,
    },
  },

  // Agents
  {
    name: 'list-agents',
    description: 'List all agents in the workspace.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'get-agent',
    description: 'Get an agent by its ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Agent ID' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'create-agent',
    description: 'Create a new publish or research agent.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Agent name' },
        type: {
          type: 'string',
          enum: ['publish', 'research'],
          description: 'Agent type',
        },
        brandSlug: { type: 'string', description: 'Brand slug to associate with' },
        prompt: { type: 'string', description: 'Agent instructions or prompt' },
        frequency: {
          type: 'string',
          enum: ['manual', 'daily', 'weekly'],
          description: 'Run frequency',
        },
        time: { type: 'string', description: 'Time of day to run (HH:MM)' },
        weekday: { type: 'string', description: 'Day of week (required for weekly frequency)' },
        kbId: { type: 'string', description: 'Knowledge base ID to attach' },
      },
      required: ['name', 'type', 'prompt', 'frequency'],
      additionalProperties: false,
    },
  },
  {
    name: 'update-agent',
    description: 'Update an agent name, prompt, frequency, or schedule.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Agent ID' },
        name: { type: 'string', description: 'New agent name' },
        prompt: { type: 'string', description: 'New prompt' },
        frequency: { type: 'string', description: 'New frequency: manual, daily, or weekly' },
        time: { type: 'string', description: 'New time of day (HH:MM)' },
        weekday: { type: 'string', description: 'New day of week' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete-agent',
    description: 'Permanently delete an agent by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Agent ID to delete' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'run-agent',
    description: 'Trigger an immediate run of an agent.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Agent ID to run' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'toggle-agent',
    description: 'Enable or disable an agent.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Agent ID to toggle' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'agent-runs',
    description: 'List the run history for an agent.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Agent ID' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },

  // Knowledge Bases
  {
    name: 'list-kbs',
    description: 'List all knowledge bases in the workspace.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'get-kb',
    description: 'Get a knowledge base by its ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Knowledge base ID' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'create-kb',
    description: 'Create a new knowledge base.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Knowledge base name' },
      },
      required: ['name'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete-kb',
    description: 'Permanently delete a knowledge base by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Knowledge base ID to delete' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'search-kb',
    description: 'Search a knowledge base with a text query.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Knowledge base ID to search' },
        query: { type: 'string', description: 'Search query text' },
      },
      required: ['id', 'query'],
      additionalProperties: false,
    },
  },
  {
    name: 'ingest-kb',
    description: 'Ingest a URL into a knowledge base.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Knowledge base ID to ingest into' },
        url: { type: 'string', description: 'URL to ingest' },
      },
      required: ['id', 'url'],
      additionalProperties: false,
    },
  },
  {
    name: 'kb-docs',
    description: 'List documents stored in a knowledge base.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Knowledge base ID' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },

  // Ideas
  {
    name: 'generate-ideas',
    description: 'AI-generate content ideas, optionally seeded from a knowledge base or topic.',
    inputSchema: {
      type: 'object',
      properties: {
        kbId: { type: 'string', description: 'Knowledge base ID to draw context from' },
        topic: { type: 'string', description: 'Topic or theme for idea generation' },
        count: { type: 'number', description: 'Number of ideas to generate (default 5)' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'list-ideas',
    description: 'List all saved content ideas.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'enrich-idea',
    description: 'Enrich an idea with additional AI-generated context.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Idea ID to enrich' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete-idea',
    description: 'Permanently delete an idea by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Idea ID to delete' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },

  // Clips
  {
    name: 'list-clips',
    description: 'List all video clips in the workspace.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'get-clip',
    description: 'Get a video clip by its ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Clip ID' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'import-clip',
    description: 'Import a video clip from a remote URL.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL of the video to import' },
        name: { type: 'string', description: 'Optional name for the imported clip' },
      },
      required: ['url'],
      additionalProperties: false,
    },
  },
  {
    name: 'render-clip',
    description: 'Trigger rendering for a video clip.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Clip ID to render' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete-clip',
    description: 'Permanently delete a video clip by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Clip ID to delete' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },

  // Carousels
  {
    name: 'list-carousels',
    description: 'List all carousels in the workspace.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'get-carousel',
    description: 'Get a carousel by its ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Carousel ID' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'create-carousel',
    description: 'Create a new empty carousel.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Optional carousel title' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'generate-carousel',
    description: 'AI-generate a carousel from a topic.',
    inputSchema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Topic to generate slides for' },
        brandSlug: { type: 'string', description: 'Brand slug for brand voice' },
        slideCount: { type: 'number', description: 'Number of slides to generate' },
      },
      required: ['topic'],
      additionalProperties: false,
    },
  },
  {
    name: 'draft-carousel',
    description: 'Convert a carousel into a post draft.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Carousel ID to convert' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete-carousel',
    description: 'Permanently delete a carousel by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Carousel ID to delete' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },

  // Webhooks
  {
    name: 'list-webhooks',
    description: 'List all webhooks in the workspace.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'get-webhook',
    description: 'Get a webhook by its ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Webhook ID' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'create-webhook',
    description: 'Create a new webhook endpoint for receiving events.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'HTTPS endpoint URL to receive events' },
        events: {
          type: 'string',
          description: 'Comma-separated event types (e.g. post.published,post.failed)',
        },
        secret: { type: 'string', description: 'Optional HMAC signing secret' },
      },
      required: ['url', 'events'],
      additionalProperties: false,
    },
  },
  {
    name: 'update-webhook',
    description: 'Update the URL, events, or active state of a webhook.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Webhook ID' },
        url: { type: 'string', description: 'New endpoint URL' },
        events: { type: 'string', description: 'New comma-separated event types' },
        active: { type: 'boolean', description: 'Whether the webhook is active' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete-webhook',
    description: 'Permanently delete a webhook by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Webhook ID to delete' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'test-webhook',
    description: 'Send a test event to a webhook endpoint.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Webhook ID to send the test event to' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },

  // Billing
  {
    name: 'billing-status',
    description: 'Get the current billing plan and subscription status.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'billing-credits',
    description: 'Get the current AI credit balance and usage breakdown.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },

  // Usage
  {
    name: 'usage-summary',
    description: 'Get a summary of post and publishing usage for the current period.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
]
