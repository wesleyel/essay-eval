interface ImportMetaEnv {
  /** 'local'：纯静态部署，数据存 IndexedDB，模型由浏览器直连 */
  readonly PUBLIC_BACKEND?: 'local';
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
