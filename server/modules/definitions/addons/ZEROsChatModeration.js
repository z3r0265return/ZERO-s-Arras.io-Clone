const bannedPatterns = [
  /\bf[\W_0-9a-z]*u[\W_0-9a-z]*c[\W_0-9a-z]*k\b/gi,             // f**k variants
  /\bs[\W_0-9a-z]*h[\W_0-9a-z]*i[\W_0-9a-z]*t\b/gi,             // s**t variants
  /\bb[\W_0-9a-z]*i[\W_0-9a-z]*t[\W_0-9a-z]*c[\W_0-9a-z]*h\b/gi,// b***h variants
  /\ba[\W_0-9a-z]*s[\W_0-9a-z]*s\b/gi,                          // a$$ variants
  /\bd[\W_0-9a-z]*i[\W_0-9a-z]*c[\W_0-9a-z]*k\b/gi,             // d*** variants
  /\bc[\W_0-9a-z]*u[\W_0-9a-z]*n[\W_0-9a-z]*t\b/gi,             // c*** variants
  /\bn[\W_0-9a-z]*[i1!l|][\W_0-9a-z]*[gq96][\W_0-9a-z]*[gq96e3a@4u$z]?\b/gi // slur – highly obfuscated
]

const maxMessageLength = 256
const ratelimitCount = 3
const ratelimitWindow = 10_000 // 10 sec window

const userMessages = new Map()

Events.on('chatMessage', ({ message, socket, preventDefault, setMessage }) => {
  const perms = socket.permissions
  const id = socket.player?.body?.id
  if (!id) return

  if (perms?.allowSpam) return

  let cleanMessage = message

  for (const pattern of bannedPatterns) {
    cleanMessage = cleanMessage.replace(pattern, match => '*'.repeat(match.length))
  }

  if (cleanMessage !== message) {
    setMessage(cleanMessage)
  }

  if (cleanMessage.length > maxMessageLength) {
    preventDefault()
    socket.talk('m', Config.MESSAGE_DISPLAY_TIME, `Message too long! Max is ${maxMessageLength} chars.`)
    return
  }

  const now = Date.now()
  const timestamps = userMessages.get(id) || []
  const recentMsgs = timestamps.filter(ts => now - ts < ratelimitWindow)

  if (recentMsgs.length >= ratelimitCount) {
    preventDefault()
    socket.talk('m', Config.MESSAGE_DISPLAY_TIME, 'Slow down, you’re sending messages too fast!')
    userMessages.set(id, recentMsgs)
    return
  }

  recentMsgs.push(now)
  userMessages.set(id, recentMsgs)
})

console.log('[ZERO\'s Chat Moderation]: Loaded and ready to eliminate banned words!')
