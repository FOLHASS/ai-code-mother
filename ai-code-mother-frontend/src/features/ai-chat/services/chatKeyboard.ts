/** 判断 Enter 按键是否应提交消息，而不是确认输入法候选词。 */
export function shouldSendMessage(
  event: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'isComposing' | 'keyCode'>,
): boolean {
  return event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229
}
