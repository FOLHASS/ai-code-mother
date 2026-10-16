/** 后端将 Long 序列化为字符串；生成的 API 错标为 number，请求时保留原值。 */
/**
 * 只在调用自动生成的 API 时适配 TypeScript 类型；as 断言不会在运行时把字符串转成数字。
 * 切勿改用 Number/parseInt：雪花 ID 可能超过 Number.MAX_SAFE_INTEGER，转换会定位到错误记录。
 */
export const asApiLongId = (id: string): number => id as unknown as number
