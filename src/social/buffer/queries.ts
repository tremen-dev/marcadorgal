// SPEC-067 CA-1, CA-3: the GraphQL documents sent to Buffer. The shape of
// the answers is in fixtures/ (captured by the probe against the real API,
// 2026-11-10) and interpreted in publisher.ts.

// The mutation of the port (ADR-030 §5). Scheduling is automatic and the
// mode is the one fixed in CA-2; both travel in the variables.
export const CREATE_POST = `mutation CreatePost($input: CreatePostInput!) {
  createPost(input: $input) {
    __typename
    ... on PostActionSuccess { post { id status dueAt sentAt externalLink } }
    ... on MutationError { message }
  }
}`;

// One post by id (CA-2 b): sentAt against the request time, and the URL
// of the tweet. Only the probe asks it: never in the tick (CA-5).
export const POST = `query Post($id: PostId!) {
  post(input: { id: $id }) {
    id status dueAt sentAt createdAt externalLink
    error { message }
  }
}`;

// The daily limit of a channel (CA-2 c). Only the probe asks it: never in
// the tick (CA-5).
export const DAILY_POSTING_LIMITS = `query DailyPostingLimits($channelIds: [ChannelId!]!) {
  dailyPostingLimits(input: { channelIds: $channelIds }) {
    channelId isAtLimit limit scheduled sent
  }
}`;

// The account and its organizations; then the channels of each one, to tell
// the test channel from the real one.
export const ACCOUNT = `query Account {
  account {
    id
    organizations { id name }
  }
}`;

export const ORGANIZATION_CHANNELS = `query OrganizationChannels($organizationId: OrganizationId!) {
  channels(input: { organizationId: $organizationId }) {
    id name displayName service type isDisconnected isLocked isQueuePaused timezone
  }
}`;

// Introspection of one type, to discover enums and input fields.
export const TYPE_INTROSPECTION = `query Type($name: String!) {
  __type(name: $name) {
    name kind
    possibleTypes { name }
    enumValues { name description }
    inputFields { name description type { name kind ofType { name kind ofType { name kind } } } }
    fields { name type { name kind ofType { name kind ofType { name kind } } } }
  }
}`;
