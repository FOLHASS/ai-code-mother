type Listener = () => void
const listeners = new Set<Listener>()

export const authEvents = {
  expired: () => {
    for (const listener of listeners) listener()
  },
  subscribe: (listener: Listener) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}
