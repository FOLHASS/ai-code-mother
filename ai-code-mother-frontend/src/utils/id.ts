/** 后端将 Long 序列化为字符串；生成的 API 错标为 number，请求时保留原值。 */
export const asApiLongId = (id: string): number => id as unknown as number
