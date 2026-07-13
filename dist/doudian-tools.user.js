// ==UserScript==
// @name        抖店工具箱
// @namespace   doudian-tools
// @version     1.0.2
// @description 抖店后台增强工具箱
// @author      xchen
// @match       https://*.jinritemai.com/*
// @icon        https://lf1-fe.ecombdstatic.com/obj/eden-cn/upqphj/homepage/icon.svg
// @require     https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js
// @connect     www.erp321.com
// @connect     api.erp321.com
// @connect     open.feishu.cn
// @connect     compass.jinritemai.com
// @connect     fxg.jinritemai.com
// @connect     api.dingtalk.com
// @connect     oapi.dingtalk.com
// @grant       GM_registerMenuCommand
// @grant       GM_unregisterMenuCommand
// @grant       GM_setValue
// @grant       GM_getValue
// @grant       GM_deleteValue
// @grant       GM_xmlhttpRequest
// @grant       GM_addStyle
// @run-at      document-start
// @updateURL   https://cdn.jsdmirror.com/gh/leoFitz1024/script@latest/dist/doudian-tools.meta.js
// @downloadURL https://cdn.jsdmirror.com/gh/leoFitz1024/script@latest/dist/doudian-tools.user.js
// ==/UserScript==

(function() {
  "use strict";
  async function getValue(key, defaultValue) {
    return await GM_getValue(key, defaultValue);
  }
  async function setValue(key, value) {
    if (value === void 0) {
      throw new Error(`禁止向脚本猫存储写入 undefined: ${key}`);
    }
    await GM_setValue(key, value);
  }
  const defaultGlobalConfig = {
    feishuAppId: "",
    feishuAppSecret: "",
    dingtalkAppKey: "",
    dingtalkAppSecret: "",
    dingtalkOperatorId: "",
    juShuiTanAccount: "",
    juShuiTanPassword: "",
    juShuiTanCookie: ""
  };
  function createDefaultGlobalConfig() {
    return { ...defaultGlobalConfig };
  }
  const CONFIG_KEY = "doudian-tools.config";
  class AppConfigStore {
    constructor(definitions) {
      this.definitions = /* @__PURE__ */ new Map();
      definitions.forEach((definition) => this.definitions.set(definition.id, definition));
      this.snapshot = this.createDefaultSnapshot(definitions);
    }
    async load() {
      const stored = await getValue(CONFIG_KEY, void 0);
      if (!stored) return;
      this.snapshot = this.normalizeSnapshot(stored);
    }
    async save() {
      await setValue(CONFIG_KEY, this.getSnapshot());
    }
    async update(mutator) {
      const draft = this.getSnapshot();
      mutator(draft);
      const nextSnapshot = this.normalizeSnapshot(draft);
      assertNoUndefined(nextSnapshot, "config");
      await setValue(CONFIG_KEY, nextSnapshot);
      this.snapshot = nextSnapshot;
    }
    getSnapshot() {
      return cloneSnapshot(this.snapshot);
    }
    getGlobal(key) {
      return this.snapshot.global[key];
    }
    setGlobal(key, value) {
      this.ensureDefined(value, `global.${key}`);
      this.snapshot.global[key] = value;
    }
    isFeatureEnabled(featureId) {
      return this.ensureFeatureState(featureId).enabled;
    }
    setFeatureEnabled(featureId, enabled) {
      this.ensureFeatureState(featureId).enabled = enabled;
    }
    feature(featureId) {
      return {
        get: (key) => this.ensureFeatureState(featureId).settings[key],
        set: (key, value) => {
          this.ensureDefined(value, `${featureId}.${String(key)}`);
          this.ensureFeatureState(featureId).settings[key] = value;
        }
      };
    }
    ensureFeatureState(featureId) {
      const state = this.snapshot.features[featureId];
      if (state) return state;
      const definition = this.definitions.get(featureId);
      if (!definition) {
        throw new Error(`未知功能 id: ${featureId}`);
      }
      const created = createFeatureState(definition);
      this.snapshot.features[featureId] = created;
      return created;
    }
    normalizeSnapshot(snapshot) {
      var _a;
      const normalized = this.createDefaultSnapshot([...this.definitions.values()]);
      normalized.global = { ...normalized.global, ...snapshot.global ?? {} };
      for (const definition of this.definitions.values()) {
        const incoming = (_a = snapshot.features) == null ? void 0 : _a[definition.id];
        if (!incoming) continue;
        const target = normalized.features[definition.id];
        target.enabled = typeof incoming.enabled === "boolean" ? incoming.enabled : target.enabled;
        target.settings = { ...target.settings, ...incoming.settings ?? {} };
        this.applyFieldDefaults(definition.settings ?? [], target.settings);
      }
      return normalized;
    }
    createDefaultSnapshot(definitions) {
      const features = {};
      definitions.forEach((definition) => {
        features[definition.id] = createFeatureState(definition);
      });
      return {
        global: createDefaultGlobalConfig(),
        features
      };
    }
    applyFieldDefaults(fields, settings) {
      for (const field of fields) {
        if (settings[field.key] !== void 0) continue;
        settings[field.key] = defaultSettingValue(field);
      }
    }
    ensureDefined(value, path) {
      if (value === void 0) {
        throw new Error(`禁止写入 undefined 配置: ${path}`);
      }
    }
  }
  function createFeatureState(definition) {
    const settings = {};
    for (const field of definition.settings ?? []) {
      settings[field.key] = defaultSettingValue(field);
    }
    return {
      enabled: definition.defaultEnabled,
      settings
    };
  }
  function defaultSettingValue(field) {
    if (field.defaultValue !== void 0) return field.defaultValue;
    return field.type === "switch" ? false : "";
  }
  function cloneSnapshot(snapshot) {
    return structuredClone(snapshot);
  }
  function assertNoUndefined(value, path) {
    if (value === void 0) {
      throw new Error(`禁止写入 undefined 配置: ${path}`);
    }
    if (!value || typeof value !== "object") {
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      assertNoUndefined(child, `${path}.${key}`);
    }
  }
  class FeatureRegistry {
    constructor() {
      this.definitions = /* @__PURE__ */ new Map();
    }
    register(definition) {
      if (this.definitions.has(definition.id)) {
        throw new Error(`功能 id 重复: ${definition.id}`);
      }
      this.definitions.set(definition.id, definition);
    }
    registerMany(definitions) {
      definitions.forEach((definition) => this.register(definition));
    }
    getAll() {
      return [...this.definitions.values()];
    }
    match(url) {
      return this.getAll().filter(
        (definition) => definition.matches.some((pattern) => {
          pattern.lastIndex = 0;
          return pattern.test(url);
        })
      );
    }
  }
  class DisposableScope {
    constructor() {
      this.disposables = [];
      this.disposed = false;
    }
    add(disposable) {
      if (this.disposed) {
        void disposable();
        return;
      }
      this.disposables.push(disposable);
    }
    async disposeAll() {
      if (this.disposed) return;
      this.disposed = true;
      const items = [...this.disposables].reverse();
      this.disposables.length = 0;
      for (const disposable of items) {
        try {
          await disposable();
        } catch {
        }
      }
    }
    get size() {
      return this.disposables.length;
    }
  }
  function toError(value) {
    if (value instanceof Error) return value;
    if (typeof value === "string") return new Error(value);
    try {
      return new Error(JSON.stringify(value));
    } catch {
      return new Error(String(value));
    }
  }
  class FeatureLifecycle {
    constructor(options) {
      this.options = options;
      this.active = /* @__PURE__ */ new Map();
    }
    async start(definition) {
      if (this.active.has(definition.id)) return;
      await this.startInternal(definition);
    }
    async stop(featureId) {
      if (featureId) {
        await this.stopInternal(featureId);
        return;
      }
      const ids = [...this.active.keys()];
      for (const id of ids) {
        await this.stopInternal(id);
      }
    }
    async reconcile(definitions) {
      const desiredIds = new Set(definitions.map((definition) => definition.id));
      for (const id of [...this.active.keys()]) {
        if (!desiredIds.has(id)) {
          await this.stopInternal(id);
        }
      }
      for (const definition of definitions) {
        if (this.active.has(definition.id)) continue;
        await this.startInternal(definition);
      }
    }
    async startInternal(definition) {
      const scope = new DisposableScope();
      const context = this.createContext(definition.id, scope);
      let instance;
      try {
        instance = definition.create(context);
        this.active.set(definition.id, { definition, scope, instance });
        await instance.init();
      } catch (error) {
        this.options.logger.error(`功能启动失败: ${definition.id}`, toError(error));
        this.active.delete(definition.id);
        await this.destroyRuntime({ definition, scope, instance });
      }
    }
    async stopInternal(featureId) {
      const runtime = this.active.get(featureId);
      if (!runtime) return;
      this.active.delete(featureId);
      await this.destroyRuntime(runtime);
    }
    async destroyRuntime(runtime) {
      var _a, _b;
      try {
        await ((_b = (_a = runtime.instance) == null ? void 0 : _a.destroy) == null ? void 0 : _b.call(_a));
      } catch (error) {
        this.options.logger.error(`功能销毁失败: ${runtime.definition.id}`, toError(error));
      } finally {
        await runtime.scope.disposeAll();
      }
    }
    createContext(featureId, disposables) {
      return {
        featureId,
        config: this.options.appConfig.feature(featureId),
        appConfig: this.options.appConfig,
        logger: this.options.logger.child(featureId),
        requestListener: this.options.requestListener,
        events: this.options.events,
        disposables
      };
    }
  }
  class Router {
    constructor(registry, config, lifecycle, logger) {
      this.registry = registry;
      this.config = config;
      this.lifecycle = lifecycle;
      this.logger = logger;
      this.started = false;
      this.lastUrl = "";
      this.reconcileChain = Promise.resolve();
      this.stopChain = Promise.resolve();
      this.originalPushState = history.pushState.bind(history);
      this.originalReplaceState = history.replaceState.bind(history);
      this.onPopState = () => {
        void this.scheduleReconcile();
      };
    }
    start() {
      if (this.started) return;
      this.started = true;
      this.patchHistory();
      window.addEventListener("popstate", this.onPopState);
      void this.scheduleReconcile(true);
    }
    async stop() {
      if (!this.started) return;
      this.started = false;
      window.removeEventListener("popstate", this.onPopState);
      this.restoreHistory();
      this.stopChain = this.reconcileChain.then(() => this.lifecycle.stop());
      await this.stopChain;
    }
    reconcile(force = false) {
      return this.enqueueReconcile(force);
    }
    scheduleReconcile(force = false) {
      void this.enqueueReconcile(force);
    }
    enqueueReconcile(force = false) {
      const run = this.reconcileChain.then(
        () => this.runReconcile(force),
        () => this.runReconcile(force)
      );
      this.reconcileChain = run.catch(() => {
      });
      return run;
    }
    async runReconcile(force = false) {
      if (!this.started) return;
      const currentUrl = this.normalizeUrl(location.href);
      if (!this.started || !force && currentUrl === this.lastUrl) return;
      this.lastUrl = currentUrl;
      if (!this.started) return;
      const matched = this.registry.match(currentUrl).filter((definition) => this.config.isFeatureEnabled(definition.id));
      if (!this.started) return;
      this.logger.debug(`路由刷新: ${currentUrl}`, matched.map((definition) => definition.id));
      if (!this.started) return;
      await this.lifecycle.reconcile(matched);
    }
    normalizeUrl(url) {
      const parsed = new URL(url, location.href);
      const pathname = parsed.pathname.replace(/\/+$/, "") || "/";
      return `${parsed.origin}${pathname}${parsed.search}`;
    }
    patchHistory() {
      history.pushState = (...args) => {
        this.originalPushState(...args);
        this.scheduleReconcile();
      };
      history.replaceState = (...args) => {
        this.originalReplaceState(...args);
        this.scheduleReconcile();
      };
    }
    restoreHistory() {
      history.pushState = this.originalPushState;
      history.replaceState = this.originalReplaceState;
    }
  }
  function registerMenuCommand(name, callback) {
    const id = GM_registerMenuCommand(name, callback);
    return () => {
      if (id !== void 0) {
        GM_unregisterMenuCommand(id);
      }
    };
  }
  function addStyleOnce(key, css) {
    const markerId = getMarkerId(key);
    if (document.getElementById(markerId) !== null) {
      return;
    }
    GM_addStyle(css);
    if (document.getElementById(markerId) === null) {
      const marker = document.createElement("meta");
      marker.id = markerId;
      marker.setAttribute("data-scriptcat-style-key", key);
      document.head.appendChild(marker);
    }
  }
  function getMarkerId(key) {
    return `scriptcat-style-marker-${key}`;
  }
  function ensureUiTheme() {
    addStyleOnce(
      "doudian-tools-ui-theme",
      `
.ddt-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.48);
  box-sizing: border-box;
}

.ddt-modal {
  display: flex;
  flex-direction: column;
  max-width: 100%;
  max-height: 100%;
  overflow: hidden;
  border-radius: 8px;
  background: #ffffff;
  color: #1f2329;
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.18);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  box-sizing: border-box;
}

.ddt-modal-header,
.ddt-modal-body,
.ddt-modal-footer {
  box-sizing: border-box;
}

.ddt-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e6eb;
}

.ddt-modal-title {
  min-width: 0;
  margin: 0;
  color: #1f2329;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}

.ddt-modal-body {
  overflow: auto;
  padding: 20px;
}

.ddt-modal-footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px 16px;
  border-top: 1px solid #e5e6eb;
}

.ddt-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 32px;
  padding: 0 12px;
  border: 1px solid #d0d3d8;
  border-radius: 6px;
  background: #ffffff;
  color: #1f2329;
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease, opacity 0.15s ease;
  box-sizing: border-box;
}

.ddt-btn:hover:not(:disabled) {
  background: #f5f6f7;
}

.ddt-btn:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.ddt-btn-small {
  min-height: 28px;
  padding: 0 10px;
  font-size: 12px;
  line-height: 18px;
}

.ddt-btn-medium {
  min-height: 32px;
}

.ddt-btn-primary {
  border-color: #1677ff;
  background: #1677ff;
  color: #ffffff;
}

.ddt-btn-primary:hover:not(:disabled) {
  background: #0f6ae6;
  border-color: #0f6ae6;
}

.ddt-btn-danger {
  border-color: #d92d20;
  background: #d92d20;
  color: #ffffff;
}

.ddt-btn-danger:hover:not(:disabled) {
  background: #c5271b;
  border-color: #c5271b;
}

.ddt-btn-text {
  border-color: transparent;
  background: transparent;
  color: #1677ff;
}

.ddt-btn-text:hover:not(:disabled) {
  background: rgba(22, 119, 255, 0.08);
}

.ddt-inline-btn {
  vertical-align: middle;
}

.ddt-inline-btn-right {
  float: right;
}

.ddt-form-field {
  display: grid;
  grid-template-columns: minmax(108px, 160px) minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.ddt-form-field:last-child {
  margin-bottom: 0;
}

.ddt-form-field-stack {
  grid-template-columns: 1fr;
  gap: 6px;
}

.ddt-form-field-label {
  color: #4e5969;
  font-size: 13px;
  line-height: 20px;
}

.ddt-form-field-control {
  min-width: 0;
}

.ddt-form-input {
  width: 100%;
  min-height: 34px;
  padding: 6px 10px;
  border: 1px solid #d0d3d8;
  border-radius: 6px;
  background: #ffffff;
  color: #1f2329;
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  box-sizing: border-box;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.ddt-form-input-small {
  min-height: 30px;
  padding: 4px 8px;
}

.ddt-form-input-medium {
  min-height: 34px;
}

textarea.ddt-form-input,
.ddt-form-textarea {
  min-height: 74px;
  resize: vertical;
}

.ddt-form-input:focus {
  border-color: #1677ff;
  box-shadow: 0 0 0 3px rgba(22, 119, 255, 0.12);
  outline: none;
}

.ddt-form-input[readonly] {
  background: #fafafa;
}

.ddt-toast-container {
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 100001;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
  box-sizing: border-box;
}

.ddt-toast {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 220px;
  max-width: 420px;
  padding: 10px 14px;
  border-radius: 6px;
  background: #ffffff;
  color: #1f2329;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.14);
  font-size: 13px;
  line-height: 20px;
  pointer-events: auto;
  box-sizing: border-box;
}

.ddt-toast-message {
  flex: 1;
  min-width: 0;
}

.ddt-toast-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #606771;
  font: inherit;
  line-height: 20px;
  cursor: pointer;
}

.ddt-toast-close:hover {
  background: #f0f1f3;
  color: #1f2329;
}

.ddt-toast-success {
  border-left: 4px solid #12b76a;
}

.ddt-toast-error {
  border-left: 4px solid #d92d20;
}

.ddt-toast-warning {
  border-left: 4px solid #f79009;
}

.ddt-toast-info {
  border-left: 4px solid #1677ff;
}

.ddt-settings-panel {
  height: min(640px, calc(100vh - 176px));
  min-height: 420px;
  margin: 0;
}

.ddt-settings-layout {
  display: grid;
  grid-template-columns: 176px minmax(0, 1fr);
  gap: 20px;
  height: 100%;
  min-height: 0;
}

.ddt-settings-nav {
  position: static;
  align-self: stretch;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 0;
  overflow-y: auto;
  padding: 4px;
  border-right: 1px solid #e5e6eb;
}

.ddt-settings-nav-link {
  display: block;
  overflow: hidden;
  padding: 8px 10px;
  border-radius: 6px;
  color: #4e5969;
  font-size: 13px;
  line-height: 20px;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ddt-settings-nav-link:hover,
.ddt-settings-nav-link:focus {
  background: #f2f6ff;
  color: #1677ff;
  outline: none;
}

.ddt-settings-content {
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  padding-right: 4px;
  scroll-behavior: smooth;
}

.ddt-settings-section {
  scroll-margin-top: 12px;
  padding-bottom: 20px;
  margin-bottom: 22px;
  border-bottom: 1px solid #e5e6eb;
}

.ddt-settings-section:last-child {
  margin-bottom: 0;
  border-bottom: 0;
}

.ddt-settings-section-title {
  margin: 0 0 14px;
  color: #1f2329;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}

.ddt-settings-feature {
  scroll-margin-top: 12px;
  padding: 14px 0 16px;
  border-top: 1px solid #f0f1f3;
}

.ddt-settings-feature:first-of-type {
  border-top: 0;
}

.ddt-settings-feature-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  margin-bottom: 12px;
}

.ddt-settings-feature-header h3 {
  margin: 0;
  color: #1f2329;
  font-size: 15px;
  font-weight: 600;
  line-height: 22px;
}

.ddt-settings-feature-header p {
  flex: 0 0 100%;
  margin: 0;
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
}

.ddt-settings-feature-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #4e5969;
  font-size: 13px;
  line-height: 20px;
}

.ddt-settings-switch-row {
  grid-template-columns: auto 1fr;
  justify-content: start;
}

.ddt-settings-switch {
  width: 16px;
  height: 16px;
  accent-color: #1677ff;
}

.ddt-product-list-sync-stock {
  margin-left: 8px;
}

.ddt-shop-rank-button {
  position: fixed;
  right: 24px;
  bottom: 96px;
  z-index: 99999;
  box-shadow: 0 10px 28px rgba(22, 119, 255, 0.22);
}

.ddt-batch-auth-apply-button {
  position: fixed;
  right: 24px;
  bottom: 96px;
  z-index: 99999;
  box-shadow: 0 10px 28px rgba(22, 119, 255, 0.22);
}

.ddt-batch-auth-apply-modal {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.ddt-batch-auth-apply-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.ddt-batch-auth-apply-account {
  color: #1f2329;
  font-size: 14px;
  line-height: 22px;
  font-weight: 600;
}

.ddt-batch-auth-apply-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ddt-batch-auth-apply-deadline {
  width: 220px;
  max-width: 100%;
}

.ddt-batch-auth-apply-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 240px;
  overflow: auto;
  padding: 12px;
  border: 1px solid #e5e6eb;
  border-radius: 6px;
  background: #fafafa;
}

.ddt-batch-auth-apply-list-item {
  padding: 8px 10px;
  border-radius: 6px;
  background: #ffffff;
  color: #1f2329;
  font-size: 13px;
  line-height: 20px;
  word-break: break-word;
}

.ddt-batch-auth-apply-list-item-failed {
  cursor: pointer;
  color: #d92d20;
}

.ddt-batch-auth-apply-result-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ddt-shop-rank-result {
  min-width: 0;
}

.ddt-shop-rank-subtitle {
  margin: 0 0 14px;
  color: #606771;
  font-size: 13px;
  line-height: 20px;
}

.ddt-shop-rank-table-wrap {
  max-height: 62vh;
  overflow: auto;
  border: 1px solid #e5e6eb;
  border-radius: 6px;
}

.ddt-shop-rank-table {
  width: 100%;
  min-width: 1040px;
  border-collapse: collapse;
  table-layout: fixed;
  color: #1f2329;
  font-size: 13px;
  line-height: 20px;
}

.ddt-shop-rank-table th,
.ddt-shop-rank-table td {
  padding: 10px 12px;
  border-bottom: 1px solid #f0f1f3;
  text-align: left;
  vertical-align: middle;
  word-break: break-word;
}

.ddt-shop-rank-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #f5f6f7;
  color: #4e5969;
  font-weight: 600;
}

.ddt-shop-rank-table tbody tr:nth-child(even) {
  background: #fafafa;
}

.ddt-shop-rank-self-row {
  background: #ecfdf3;
  box-shadow: inset 4px 0 0 #12b76a;
}

.ddt-shop-rank-table tbody tr.ddt-shop-rank-self-row:nth-child(even) {
  background: #ecfdf3;
}

.ddt-shop-rank-rank,
.ddt-shop-rank-missing,
.ddt-shop-rank-self-rank {
  font-weight: 600;
}

.ddt-shop-rank-rank {
  color: #1677ff;
}

.ddt-shop-rank-self-rank {
  color: #027a48;
}

.ddt-shop-rank-missing {
  color: #d92d20;
}

.ddt-shop-rank-self-badge {
  display: inline-flex;
  align-items: center;
  margin-left: 6px;
  padding: 0 6px;
  border: 1px solid #12b76a;
  border-radius: 6px;
  background: #ffffff;
  color: #027a48;
  font-size: 12px;
  line-height: 18px;
  font-weight: 600;
}

.ddt-shop-rank-empty {
  color: #86909c;
  text-align: center;
}

@media (max-width: 720px) {
  .ddt-settings-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0, 1fr);
  }

  .ddt-settings-nav {
    position: static;
    flex-direction: row;
    overflow-x: auto;
    overflow-y: hidden;
    border-right: 0;
    border-bottom: 1px solid #e5e6eb;
    padding-bottom: 8px;
  }

  .ddt-settings-nav-link {
    flex: 0 0 auto;
  }

  .ddt-form-field {
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .ddt-shop-rank-button {
    right: 16px;
    bottom: 72px;
  }

  .ddt-batch-auth-apply-button {
    right: 16px;
    bottom: 72px;
  }

  .ddt-batch-auth-apply-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .ddt-batch-auth-apply-deadline {
    width: 100%;
  }
}
`
    );
  }
  function createButton(options) {
    ensureUiTheme();
    const button = document.createElement("button");
    const variant = options.variant ?? "secondary";
    const size = options.size ?? "medium";
    button.type = "button";
    button.className = `ddt-btn ddt-btn-${variant} ddt-btn-${size}`;
    button.textContent = options.text;
    button.disabled = options.disabled ?? false;
    if (options.onClick) {
      const handleClick = options.onClick;
      button.addEventListener("click", (event) => {
        if (button.disabled) {
          return;
        }
        const originalText = button.textContent ?? options.text;
        const originalDisabled = button.disabled;
        try {
          const result = handleClick(event);
          if (isPromiseLike(result)) {
            void handleAsyncClick(button, result, originalText, originalDisabled, options.loadingText).catch((error) => {
              console.error(error);
            });
          }
        } catch (error) {
          console.error(error);
        }
      });
    }
    return button;
  }
  function createInlineButton(options) {
    const button = createButton(options);
    button.classList.add("ddt-inline-btn");
    if (options.align === "right") {
      button.classList.add("ddt-inline-btn-right");
    }
    if (typeof options.offsetTop === "number") {
      button.style.marginTop = `${options.offsetTop}px`;
    }
    appendClassNames$2(button, options.className);
    return button;
  }
  function appendClassNames$2(button, className) {
    if (!className) {
      return;
    }
    const classNames = className.split(/\s+/).map((item) => item.trim()).filter(Boolean);
    if (classNames.length === 0) {
      return;
    }
    button.classList.add(...classNames);
  }
  async function handleAsyncClick(button, promise, originalText, originalDisabled, loadingText) {
    button.disabled = true;
    button.textContent = loadingText ?? "处理中...";
    try {
      await promise;
    } finally {
      button.disabled = originalDisabled;
      button.textContent = originalText;
    }
  }
  function isPromiseLike(value) {
    return (typeof value === "object" || typeof value === "function") && value !== null && typeof value.then === "function";
  }
  function createFormField(options) {
    ensureUiTheme();
    const wrapper = document.createElement("div");
    wrapper.classList.add("ddt-form-field", `ddt-form-field-${options.layout ?? "row"}`);
    appendClassNames$1(wrapper, options.className);
    Object.assign(wrapper.style, options.style ?? {});
    const label = document.createElement("span");
    label.classList.add("ddt-form-field-label");
    label.textContent = options.label;
    appendClassNames$1(label, options.labelClassName);
    const controlWrapper = document.createElement("div");
    controlWrapper.classList.add("ddt-form-field-control");
    appendClassNames$1(controlWrapper, options.controlClassName);
    controlWrapper.append(options.control);
    wrapper.append(label, controlWrapper);
    return wrapper;
  }
  function appendClassNames$1(element, className) {
    if (!className) {
      return;
    }
    const classNames = className.split(/\s+/).map((item) => item.trim()).filter(Boolean);
    if (classNames.length > 0) {
      element.classList.add(...classNames);
    }
  }
  function createTextInput(options = {}) {
    ensureUiTheme();
    const input = document.createElement("input");
    input.type = options.type ?? "text";
    applyControlOptions(input, options);
    input.classList.add("ddt-form-input", `ddt-form-input-${options.size ?? "medium"}`);
    appendClassNames(input, options.className);
    return input;
  }
  function createTextarea(options = {}) {
    ensureUiTheme();
    const textarea = document.createElement("textarea");
    applyControlOptions(textarea, options);
    textarea.classList.add("ddt-form-input", "ddt-form-textarea", `ddt-form-input-${options.size ?? "medium"}`);
    if (typeof options.rows === "number") {
      textarea.rows = options.rows;
    }
    appendClassNames(textarea, options.className);
    return textarea;
  }
  function applyControlOptions(control, options) {
    if (options.name) {
      control.name = options.name;
    }
    if (typeof options.value === "string") {
      control.value = options.value;
    }
    if (typeof options.placeholder === "string") {
      control.placeholder = options.placeholder;
    }
    if (typeof options.disabled === "boolean") {
      control.disabled = options.disabled;
    }
    if (typeof options.readOnly === "boolean") {
      control.readOnly = options.readOnly;
    }
    if (options.autocomplete) {
      control.autocomplete = options.autocomplete;
    }
    if (options.ariaLabel) {
      control.setAttribute("aria-label", options.ariaLabel);
    }
    if (options.readOnlyUntilFocus) {
      control.readOnly = true;
      control.addEventListener("focus", () => {
        control.readOnly = false;
      }, { once: true });
    }
    for (const [name, value] of Object.entries(options.attributes ?? {})) {
      control.setAttribute(name, value);
    }
    Object.assign(control.style, options.style ?? {});
  }
  function appendClassNames(element, className) {
    if (!className) {
      return;
    }
    const classNames = className.split(/\s+/).map((item) => item.trim()).filter(Boolean);
    if (classNames.length > 0) {
      element.classList.add(...classNames);
    }
  }
  function openModal(options) {
    ensureUiTheme();
    const overlay = document.createElement("div");
    overlay.className = "ddt-modal-overlay";
    const modal = document.createElement("div");
    modal.className = "ddt-modal";
    modal.style.width = normalizeWidth(options.width);
    const header = document.createElement("div");
    header.className = "ddt-modal-header";
    const title = document.createElement("h3");
    title.className = "ddt-modal-title";
    title.textContent = options.title ?? "";
    const body = document.createElement("div");
    body.className = "ddt-modal-body";
    appendContent(body, options.content);
    const footer = options.footer !== void 0 ? buildFooter(options.footer) : null;
    let closed = false;
    const instance = {
      element: overlay,
      close: () => {
        var _a;
        if (closed) {
          return;
        }
        closed = true;
        document.removeEventListener("keydown", onKeyDown);
        overlay.removeEventListener("click", onOverlayClick);
        overlay.remove();
        (_a = options.onClose) == null ? void 0 : _a.call(options);
      }
    };
    const closeButton = createButton({
      text: "关闭",
      variant: "text",
      size: "small",
      onClick: () => {
        instance.close();
      }
    });
    header.append(title, closeButton);
    modal.append(header, body);
    if (footer) {
      modal.append(footer);
    }
    overlay.append(modal);
    const onOverlayClick = (event) => {
      if (event.target !== overlay || (options.closeOnOverlay ?? true) !== true) {
        return;
      }
      instance.close();
    };
    const onKeyDown = (event) => {
      if (event.key !== "Escape" || (options.closeOnEsc ?? true) !== true) {
        return;
      }
      instance.close();
    };
    overlay.addEventListener("click", onOverlayClick);
    document.addEventListener("keydown", onKeyDown);
    const host = getMountHost$2();
    host.append(overlay);
    return instance;
  }
  function appendContent(target, content) {
    if (typeof content === "function") {
      target.append(content());
      return;
    }
    if (typeof content === "string") {
      target.textContent = content;
      return;
    }
    target.append(content);
  }
  function buildFooter(content) {
    const footer = document.createElement("div");
    footer.className = "ddt-modal-footer";
    if (typeof content === "string") {
      footer.textContent = content;
    } else {
      footer.append(content);
    }
    return footer;
  }
  function normalizeWidth(width) {
    if (typeof width === "number") {
      return `${width}px`;
    }
    return width ?? "640px";
  }
  function getMountHost$2() {
    return document.body ?? document.documentElement;
  }
  const Toast = {
    show(options) {
      ensureUiTheme();
      const container = getToastContainer();
      const toast = document.createElement("div");
      toast.className = `ddt-toast ddt-toast-${options.type}`;
      const message = document.createElement("span");
      message.className = "ddt-toast-message";
      message.textContent = options.message;
      toast.append(message);
      if (options.closable) {
        const closeButton = document.createElement("button");
        closeButton.type = "button";
        closeButton.className = "ddt-toast-close";
        closeButton.setAttribute("aria-label", "关闭通知");
        closeButton.textContent = "×";
        closeButton.addEventListener("click", () => {
          toast.remove();
        });
        toast.append(closeButton);
      }
      container.append(toast);
      const duration = options.duration ?? 2500;
      if (duration > 0) {
        window.setTimeout(() => {
          toast.remove();
        }, duration);
      }
      return toast;
    },
    success(message) {
      return Toast.show({ type: "success", message });
    },
    error(message) {
      return Toast.show({ type: "error", message });
    },
    warning(message) {
      return Toast.show({ type: "warning", message });
    },
    info(message) {
      return Toast.show({ type: "info", message });
    }
  };
  let toastContainer = null;
  function getToastContainer() {
    if (toastContainer == null ? void 0 : toastContainer.isConnected) {
      return toastContainer;
    }
    const existing = document.querySelector(".ddt-toast-container");
    if (existing) {
      toastContainer = existing;
      return existing;
    }
    const container = document.createElement("div");
    container.className = "ddt-toast-container";
    getMountHost$1().append(container);
    toastContainer = container;
    return container;
  }
  function getMountHost$1() {
    return document.body ?? document.documentElement;
  }
  const globalSettingFields = [
    { type: "text", key: "feishuAppId", label: "飞书 App ID", defaultValue: defaultGlobalConfig.feishuAppId },
    { type: "password", key: "feishuAppSecret", label: "飞书 App Secret", defaultValue: defaultGlobalConfig.feishuAppSecret },
    { type: "text", key: "dingtalkAppKey", label: "钉钉 App Key", defaultValue: defaultGlobalConfig.dingtalkAppKey },
    { type: "password", key: "dingtalkAppSecret", label: "钉钉 App Secret", defaultValue: defaultGlobalConfig.dingtalkAppSecret },
    { type: "text", key: "dingtalkOperatorId", label: "钉钉 Operator ID", defaultValue: defaultGlobalConfig.dingtalkOperatorId },
    { type: "text", key: "juShuiTanAccount", label: "聚水潭账号", defaultValue: defaultGlobalConfig.juShuiTanAccount },
    { type: "password", key: "juShuiTanPassword", label: "聚水潭密码", defaultValue: defaultGlobalConfig.juShuiTanPassword },
    { type: "textarea", key: "juShuiTanCookie", label: "聚水潭 Cookie", defaultValue: defaultGlobalConfig.juShuiTanCookie }
  ];
  function createSwitchField(name, checked) {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = name;
    input.checked = checked;
    return input;
  }
  class SettingsPanel {
    constructor(options) {
      this.options = options;
    }
    open() {
      const form = document.createElement("form");
      form.className = "ddt-settings-panel";
      form.autocomplete = "off";
      const layout = document.createElement("div");
      layout.className = "ddt-settings-layout";
      layout.append(this.renderNavigation(), this.renderContent());
      form.append(layout);
      let modal;
      const saveButton = createButton({
        text: "保存设置",
        variant: "primary",
        loadingText: "保存中...",
        onClick: async (event) => {
          event.preventDefault();
          try {
            await this.save(form);
            modal.close();
            Toast.success("设置已保存");
          } catch (error) {
            Toast.error(this.formatSaveError(error));
          }
        }
      });
      modal = openModal({
        title: "设置",
        content: form,
        width: 860,
        footer: saveButton,
        closeOnOverlay: false,
        closeOnEsc: false
      });
      return modal;
    }
    renderNavigation() {
      const nav = document.createElement("nav");
      nav.className = "ddt-settings-nav";
      nav.setAttribute("aria-label", "设置导航");
      nav.append(
        this.createNavLink("全局配置", "#ddt-settings-global"),
        this.createNavLink("功能开关", "#ddt-settings-features")
      );
      for (const feature of this.options.features) {
        nav.append(this.createNavLink(feature.name, `#${this.getFeatureSectionId(feature.id)}`));
      }
      return nav;
    }
    renderContent() {
      const content = document.createElement("div");
      content.className = "ddt-settings-content";
      content.append(
        this.renderSection("全局配置", "ddt-settings-global", globalSettingFields, (field) => this.renderGlobalField(field)),
        this.renderFeatureSection()
      );
      return content;
    }
    renderFeatureSection() {
      const section = document.createElement("section");
      section.id = "ddt-settings-features";
      section.className = "ddt-settings-section";
      section.append(this.createSectionTitle("功能开关"));
      for (const feature of this.options.features) {
        const featureBlock = document.createElement("section");
        featureBlock.id = this.getFeatureSectionId(feature.id);
        featureBlock.className = "ddt-settings-feature";
        featureBlock.append(this.createFeatureHeader(feature));
        for (const field of feature.settings ?? []) {
          featureBlock.append(this.renderFeatureField(feature, field));
        }
        section.append(featureBlock);
      }
      return section;
    }
    renderGlobalField(field) {
      return this.createFieldRow(`global.${field.key}`, field, this.options.config.getGlobal(field.key) ?? "");
    }
    renderFeatureField(feature, field) {
      const currentValue = this.options.config.feature(feature.id).get(field.key);
      return this.createFieldRow(`feature.${feature.id}.settings.${field.key}`, field, currentValue);
    }
    renderSection(title, id, fields, renderField) {
      const section = document.createElement("section");
      section.id = id;
      section.className = "ddt-settings-section";
      section.append(this.createSectionTitle(title));
      for (const field of fields) {
        section.append(renderField(field));
      }
      return section;
    }
    createFieldInput(name, field, value) {
      const textValue = typeof value === "string" ? value : "";
      const options = this.createFieldOptions(field);
      switch (field.type) {
        case "password":
          return createTextInput({
            ...options,
            name,
            value: textValue,
            ariaLabel: field.label,
            type: "password"
          });
        case "textarea":
          return createTextarea({
            ...options,
            name,
            value: textValue,
            ariaLabel: field.label
          });
        case "switch":
          const input = createSwitchField(name, Boolean(value));
          input.className = "ddt-settings-switch";
          return input;
        case "text":
        default:
          return createTextInput({
            ...options,
            name,
            value: textValue,
            ariaLabel: field.label,
            type: "text"
          });
      }
    }
    /**
     * 创建单行设置项。
     * 普通文本类字段统一走共享表单项组件，开关字段保持当前轻量结构，避免本次范围继续膨胀。
     */
    createFieldRow(name, field, value) {
      const input = this.createFieldInput(name, field, value);
      if (field.type === "switch") {
        const wrapper = document.createElement("label");
        wrapper.className = "ddt-form-field ddt-form-field-row ddt-settings-switch-row";
        wrapper.append(this.createLabelText(field.label), input);
        return wrapper;
      }
      return createFormField({
        label: field.label,
        control: input,
        className: "ddt-form-field-row"
      });
    }
    async save(form) {
      var _a, _b;
      await this.options.config.update((draft) => {
        for (const field of globalSettingFields) {
          const input = form.elements.namedItem(`global.${field.key}`);
          if (!input || !(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) {
            continue;
          }
          draft.global[field.key] = input.value;
        }
        for (const feature of this.options.features) {
          const featureState = draft.features[feature.id];
          if (!featureState) {
            continue;
          }
          const enabledInput = form.elements.namedItem(`feature.${feature.id}.enabled`);
          if (enabledInput instanceof HTMLInputElement) {
            featureState.enabled = enabledInput.checked;
          }
          for (const field of feature.settings ?? []) {
            const name = `feature.${feature.id}.settings.${field.key}`;
            const input = form.elements.namedItem(name);
            if (!input) {
              continue;
            }
            if (field.type === "switch" && input instanceof HTMLInputElement) {
              featureState.settings[field.key] = input.checked;
              continue;
            }
            if ((input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) && typeof input.value === "string") {
              featureState.settings[field.key] = input.value;
            }
          }
        }
      });
      await ((_b = (_a = this.options).onSaved) == null ? void 0 : _b.call(_a));
    }
    formatSaveError(error) {
      if (error instanceof Error && error.message) {
        return `设置保存失败：${error.message}`;
      }
      if (typeof error === "string" && error.trim()) {
        return `设置保存失败：${error}`;
      }
      return "设置保存失败";
    }
    createSectionTitle(title) {
      const heading = document.createElement("h2");
      heading.className = "ddt-settings-section-title";
      heading.textContent = title;
      return heading;
    }
    createFeatureHeader(feature) {
      const wrapper = document.createElement("div");
      wrapper.className = "ddt-settings-feature-header";
      const title = document.createElement("h3");
      title.textContent = feature.name;
      const toggle = document.createElement("label");
      toggle.className = "ddt-settings-feature-toggle";
      const enabledName = `feature.${feature.id}.enabled`;
      const enabled = this.options.config.isFeatureEnabled(feature.id);
      const checkbox = createSwitchField(enabledName, enabled);
      checkbox.className = "ddt-settings-switch";
      toggle.append(checkbox, this.createLabelText("启用"));
      const description = document.createElement("p");
      description.textContent = feature.description;
      wrapper.append(title, toggle, description);
      return wrapper;
    }
    createLabelText(text) {
      const span = document.createElement("span");
      span.className = "ddt-form-field-label";
      span.textContent = text;
      return span;
    }
    createNavLink(label, href) {
      const link = document.createElement("a");
      link.className = "ddt-settings-nav-link";
      link.href = href;
      link.textContent = label;
      link.addEventListener("click", (event) => {
        var _a;
        event.preventDefault();
        (_a = document.getElementById(href.slice(1))) == null ? void 0 : _a.scrollIntoView({ block: "start" });
      });
      return link;
    }
    getFeatureSectionId(featureId) {
      return `ddt-settings-feature-${featureId}`;
    }
    createFieldOptions(field) {
      if (!this.isSensitiveField(field)) {
        return { autocomplete: "off" };
      }
      return {
        autocomplete: field.type === "password" ? "new-password" : "off",
        readOnlyUntilFocus: true,
        attributes: {
          "data-lpignore": "true",
          "data-1p-ignore": "true",
          spellcheck: "false",
          autocapitalize: "off",
          autocorrect: "off"
        }
      };
    }
    isSensitiveField(field) {
      const key = field.key.toLowerCase();
      return field.type === "password" || key.includes("password") || key.includes("secret") || key.includes("account") || key.includes("cookie");
    }
  }
  function request(options) {
    const headers = options.headers ?? {};
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: options.method ?? "GET",
        url: options.url,
        headers,
        data: normalizeData(options.data, headers),
        timeout: options.timeout,
        withCredentials: options.withCredentials,
        onload: (response) => {
          resolve({
            status: response.status,
            statusText: response.statusText,
            text: response.responseText
          });
        },
        onerror: (error) => {
          reject(new Error(`HTTP 请求失败: ${error}`));
        },
        ontimeout: () => {
          reject(new Error(`HTTP 请求超时: ${options.url}`));
        }
      });
    });
  }
  function normalizeData(data, headers) {
    if (data === void 0 || data === null) {
      return null;
    }
    if (typeof data === "string" || data instanceof FormData) {
      return data;
    }
    const contentType = getHeaderValue(headers, "content-type") ?? "application/json";
    if (contentType.includes("application/json")) {
      return JSON.stringify(data);
    }
    return String(data);
  }
  function getHeaderValue(headers, name) {
    const lowerName = name.toLowerCase();
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === lowerName) {
        return value;
      }
    }
    return void 0;
  }
  class JuShuiTanClient {
    constructor(options) {
      this.options = options;
      this.requester = options.requester ?? request;
    }
    hasCredentials() {
      return Boolean(this.getCookie() || this.getAccount() && this.getPassword());
    }
    async querySkuInventory(skuId) {
      const cookie = this.getCookie();
      const account = this.getAccount();
      const password = this.getPassword();
      if (!cookie && !(account && password)) {
        throw new Error("请先完善聚水潭账号、密码或 Cookie 配置");
      }
      const callbackParam = JSON.stringify({
        Method: "LoadDataToJSON",
        Args: ["1", `[{"k":"sku_id","v":"${skuId}","c":"like"}]`, "{}"]
      });
      const params = `__VIEWSTATE=%2FwEPDwUJODM5NTMzOTI4ZGTtJUMi9F3N%2BCPFxLslTA6OgxaSEA%3D%3D&__VIEWSTATEGENERATOR=491FF2E7&sku_id=${encodeURIComponent(skuId)}&_jt_page_size=500&__CALLBACKID=JTable1&__CALLBACKPARAM=${encodeURIComponent(callbackParam)}`;
      const response = await this.requester({
        method: "POST",
        url: "https://www.erp321.com/app/item/SkuStock/SkuStock.aspx?_c=jst-epaas&am___=LoadDataToJSON",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          ...cookie ? { Cookie: cookie } : {}
        },
        data: params
      });
      if (response.status < 200 || response.status >= 300) {
        throw new Error(`聚水潭库存查询失败: ${response.status} ${response.statusText}`);
      }
      return parseInventoryResponse(response.text);
    }
    getAccount() {
      return String(this.options.appConfig.getGlobal("juShuiTanAccount") ?? "").trim();
    }
    getPassword() {
      return String(this.options.appConfig.getGlobal("juShuiTanPassword") ?? "").trim();
    }
    getCookie() {
      return String(this.options.appConfig.getGlobal("juShuiTanCookie") ?? "").trim();
    }
  }
  function parseInventoryResponse(text) {
    if (!text.trim()) {
      return [];
    }
    const trimmed = text.trim();
    const raw = normalizeInventoryPayload(trimmed);
    const payload = JSON.parse(raw);
    if (!payload.IsSuccess) {
      return [];
    }
    const value = JSON.parse(payload.ReturnValue ?? "{}");
    return Array.isArray(value.datas) ? value.datas : [];
  }
  function normalizeInventoryPayload(text) {
    const withoutAmpersand = text.startsWith("&&") ? text.slice(2) : text;
    return withoutAmpersand.replace(/^\d+\|/, "");
  }
  class JuShuiTanStockService {
    constructor(options) {
      this.client = new JuShuiTanClient({
        appConfig: options.appConfig,
        requester: options.requester
      });
    }
    /**
     * 按基础 skuId 拉取库存，并返回“在仓库存 + 采购库存”的结构化结果。
     * 返回值始终以真实 `skuId` 为 key，未命中的 skuId 不会写入结果。
     */
    async getProductInventory(skuIds) {
      if (!this.client.hasCredentials()) {
        throw new Error("请先完善聚水潭账号、密码或 Cookie 配置");
      }
      const uniqueIds = [...new Set(skuIds.map((item) => item.trim()).filter(Boolean))];
      const result = /* @__PURE__ */ new Map();
      await Promise.all(
        uniqueIds.map(async (skuId) => {
          const rows = await this.client.querySkuInventory(skuId);
          for (const row of rows) {
            const skuData = row;
            const resolvedSkuId = String(skuData.sku_id ?? "").trim();
            if (!resolvedSkuId) {
              continue;
            }
            const qty = toNumber(skuData.qty);
            const lockQty = toNumber(skuData.lock_qty);
            const warehouseLockQty = toNumber(skuData.lwh_result_lock_qty);
            const orderLock = toNumber(skuData.order_lock);
            const inQty = toNumber(skuData.in_qty);
            const purchaseQty = toNumber(skuData.purchase_qty);
            result.set(resolvedSkuId, {
              availableStock: qty + inQty - lockQty - warehouseLockQty - orderLock,
              purchaseStock: purchaseQty
            });
          }
        })
      );
      return result;
    }
  }
  function toNumber(value) {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }
  function asRecord$1(value) {
    return value && typeof value === "object" ? value : void 0;
  }
  function getArrayAtPath(source, path) {
    let current = source;
    for (const key of path) {
      if (typeof key === "number") {
        if (!Array.isArray(current)) {
          return void 0;
        }
        current = current[key];
        continue;
      }
      const record = asRecord$1(current);
      if (!record) {
        return void 0;
      }
      current = record[key];
    }
    return Array.isArray(current) ? current : void 0;
  }
  function findInObjectGraph(source, matcher) {
    const visited = /* @__PURE__ */ new WeakSet();
    const walk = (value) => {
      const matched = matcher(value);
      if (matched !== void 0) {
        return matched;
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          const found = walk(item);
          if (found !== void 0) {
            return found;
          }
        }
        return void 0;
      }
      const record = asRecord$1(value);
      if (!record) {
        return void 0;
      }
      if (visited.has(record)) {
        return void 0;
      }
      visited.add(record);
      for (const child of Object.values(record)) {
        const found = walk(child);
        if (found !== void 0) {
          return found;
        }
      }
      return void 0;
    };
    return walk(source);
  }
  function waitForElement(selector, options = {}) {
    const existing = queryElement(selector, options.root);
    if (existing) {
      return Promise.resolve(existing);
    }
    return new Promise((resolve, reject) => {
      const controller = createWaitController(() => {
        const matched = queryElement(selector, options.root);
        if (!matched) {
          return;
        }
        controller.dispose();
        resolve(matched);
      }, options.observeTarget);
      if (typeof options.timeoutMs === "number" && Number.isFinite(options.timeoutMs) && options.timeoutMs >= 0) {
        controller.timeoutId = window.setTimeout(() => {
          controller.dispose();
          reject(new Error(`等待元素超时: ${selector}`));
        }, options.timeoutMs);
      }
    });
  }
  function runWhenElementReady(selector, callback, options = {}) {
    const existing = queryElement(selector, options.root);
    if (existing) {
      callback(existing);
      return createNoopDisposable();
    }
    const controller = createWaitController(() => {
      const matched = queryElement(selector, options.root);
      if (!matched) {
        return;
      }
      controller.dispose();
      callback(matched);
    }, options.observeTarget);
    return controller.dispose;
  }
  function createWaitController(callback, observeTarget) {
    const observer = new MutationObserver(callback);
    observer.observe(resolveObserveTarget(observeTarget), {
      childList: true,
      subtree: true
    });
    let disposed = false;
    let timeoutId;
    const dispose = () => {
      if (disposed) {
        return;
      }
      disposed = true;
      observer.disconnect();
      if (timeoutId !== void 0) {
        window.clearTimeout(timeoutId);
        timeoutId = void 0;
      }
    };
    return {
      dispose,
      get timeoutId() {
        return timeoutId;
      },
      set timeoutId(value) {
        timeoutId = value;
      }
    };
  }
  function queryElement(selector, root) {
    return (root ?? document).querySelector(selector);
  }
  function resolveObserveTarget(observeTarget) {
    return observeTarget ?? document.body ?? document.documentElement ?? document;
  }
  function createNoopDisposable() {
    return () => void 0;
  }
  function extractPopupTableRows(dataList) {
    if (!Array.isArray(dataList)) {
      return [];
    }
    const rows = [];
    for (const item of dataList) {
      const record = asRecord$1(item);
      if (!record) {
        continue;
      }
      const realRow = extractRealPopupTableRow(record);
      if (realRow) {
        rows.push(realRow);
        continue;
      }
      const legacyRow = extractLegacyPopupTableRow(record);
      if (legacyRow) {
        rows.push(legacyRow);
      }
    }
    return rows;
  }
  function extractLegacyPopupTableRow(record) {
    const header = Array.isArray(record.header) ? record.header : [];
    const tableInfo = asRecord$1(record.tableInfo);
    const fc = asRecord$1(tableInfo == null ? void 0 : tableInfo.fc);
    if (!fc || typeof fc.getValue !== "function") {
      return void 0;
    }
    let rowData;
    try {
      rowData = asRecord$1(fc.getValue());
    } catch {
      return void 0;
    }
    if (!rowData) {
      return void 0;
    }
    const root = asRecord$1(fc == null ? void 0 : fc.root);
    const emit = root == null ? void 0 : root.emit;
    const code = sanitizeSkuCode(String((rowData == null ? void 0 : rowData.code) ?? ""));
    if (!code) {
      return void 0;
    }
    const sizeName = getHeaderName(header[1]);
    const sizeToken = normalizeSizeInfo(sizeName);
    const baseSkuId = stripSizeSuffix(code, sizeToken);
    const isPreSaleByHeader = getHeaderName(header[2]).includes("天内发货");
    const multiTimeStocks = getMultiTimeStocks(rowData);
    const hasMultiTimeStocks = multiTimeStocks.length > 0;
    let dirty = false;
    return {
      code,
      baseSkuId,
      hasMultiTimeStocks,
      isPreSaleByHeader,
      applyCurrentStock: (value) => {
        rowData.num = String(value);
        dirty = true;
      },
      applyPurchaseStock: (value) => {
        if (!hasMultiTimeStocks) {
          return;
        }
        for (const stockItem of multiTimeStocks) {
          stockItem.stock_num = value;
        }
        dirty = true;
      },
      commit: () => {
        if (!dirty) {
          return;
        }
        dirty = false;
        if (typeof emit === "function") {
          emit.call(root);
        }
      }
    };
  }
  function extractRealPopupTableRow(record) {
    const code = sanitizeSkuCode(readString(record.skuCode));
    const spotForm = asRecord$1(record.spotForm) ?? asRecord$1(record.form);
    const presaleForms = Array.isArray(record.presaleForms) ? record.presaleForms : [];
    const baseSkuId = stripCodeTail(code);
    if (!code || !spotForm) {
      return void 0;
    }
    return {
      code,
      baseSkuId,
      hasMultiTimeStocks: presaleForms.length > 0,
      isPreSaleByHeader: false,
      applyCurrentStock: (value) => {
        updateBatchStockForm(spotForm, value);
      },
      applyPurchaseStock: (value) => {
        for (const form of presaleForms) {
          updateBatchStockForm(form, value);
        }
      },
      commit: () => void 0
    };
  }
  function normalizeSizeInfo(sizeStr, keepHyphen = false) {
    const rawText = String(sizeStr || "").trim();
    if (!rawText) {
      return "";
    }
    const pureSizeText = rawText.replace(/（[^）]*）|\([^)]*\)/g, " ").trim();
    if (!pureSizeText) {
      return "";
    }
    const rangeMatch = pureSizeText.match(/(\d+(?:\.\d+)?)\s*[-－–—]\s*(\d+(?:\.\d+)?)/);
    if (rangeMatch) {
      const left = normalizeNumericToken(rangeMatch[1]);
      const right = normalizeNumericToken(rangeMatch[2]);
      return keepHyphen ? `${left}-${right}` : `${left}${right}`;
    }
    const singleMatch = pureSizeText.match(/(\d+(?:\.\d+)?)/);
    if (!singleMatch) {
      return "";
    }
    return normalizeNumericToken(singleMatch[1]);
  }
  function sanitizeSkuCode(code) {
    return String(code).trim().replace(/[=+]/g, "");
  }
  function getMultiTimeStocks(source) {
    const raw = source.multi_time_stocks;
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw.map((item) => asRecord$1(item)).filter((item) => Boolean(item));
  }
  function updateBatchStockForm(form, stock) {
    var _a;
    const valueRef = asRecord$1((_a = asRecord$1(form)) == null ? void 0 : _a.value);
    const oldValue = asRecord$1(valueRef == null ? void 0 : valueRef.value);
    if (!oldValue) {
      return;
    }
    const currentStock = Number(oldValue.stock_num);
    if (!Number.isFinite(currentStock)) {
      throw new Error("库存表单缺少有效的当前库存");
    }
    const stockDifference = stock - currentStock;
    valueRef.value = {
      ...oldValue,
      final_stock: stock,
      change: {
        ...asRecord$1(oldValue.change),
        type: stockDifference < 0 ? "dec" : "inc",
        num: stockDifference === 0 ? void 0 : Math.abs(stockDifference)
      }
    };
  }
  function readString(value) {
    return typeof value === "string" ? value : "";
  }
  function stripSizeSuffix(code, sizeToken) {
    if (!sizeToken) {
      return code;
    }
    return code.endsWith(sizeToken) ? code.slice(0, -sizeToken.length) : code;
  }
  function stripCodeTail(code) {
    return code.slice(0, -4);
  }
  function normalizeNumericToken(value) {
    return value.replace(/[^\d]/g, "");
  }
  function getHeaderName(source) {
    var _a;
    const value = (_a = asRecord$1(source)) == null ? void 0 : _a.name;
    return typeof value === "string" ? value : "";
  }
  const STOCK_DRAWER_SELECTOR = ".auxo-drawer-content-wrapper";
  const STOCK_DRAWER_TITLE_SELECTOR = ".auxo-drawer-title";
  const STOCK_DRAWER_TITLE_TEXT = "编辑库存";
  const EDIT_METHOD_HEADER_SELECTOR = '[class*="editMethodHeader-"]';
  const EDIT_METHOD_TABS_SELECTOR = '[class*="tabs-"]';
  const EDIT_METHOD_CONTAINER_SELECTOR = '[class*="editMethodContainer-"]';
  const STOCK_TABLE_CONTAINER_SELECTOR = ".optimus_fems-table-container";
  const STOCK_TABLE_WRAPPER_SELECTOR = ".optimus_fems-table-wrapper";
  const STOCK_DRAWER_BODY_SELECTOR = ".auxo-drawer-body";
  const STOCK_DRAWER_CONTENT_SELECTOR = '[class*="content-"]';
  const STOCK_SKU_CELL_SELECTOR = "td";
  const CONTROL_GROUP_SELECTOR = ".ddt-product-list-sync-stock-group";
  const REAL_TABLE_DATA_PATH = [
    "memoizedProps",
    "children",
    "props",
    "children",
    1,
    "props",
    "children",
    "props",
    "children",
    1,
    "props",
    "data"
  ];
  const LEGACY_TABLE_DATA_PATH = ["memoizedProps", "children", "props", "children", 1, "props", "data"];
  const INLINE_ALIGN_CENTER = "center";
  const INLINE_DISPLAY = "inline-flex";
  const CONTROL_GAP = "8px";
  const CHECKBOX_GAP = "4px";
  const CHECKBOX_FONT_SIZE = "12px";
  const CHECKBOX_LINE_HEIGHT = "18px";
  const CHECKBOX_TEXT_COLOR = "#4e5969";
  const UNMATCHED_CHECKBOX_TITLE = "当商品编码在聚水潭未匹配时，清空库存。";
  class ProductListStockSync {
    constructor(options) {
      this.options = options;
      this.clearUnmatchedEnabled = true;
      this.handleDocumentClick = (event) => {
        const target = event.target;
        if (!(target instanceof Element)) {
          return;
        }
        const trigger = target.closest('span[data-kora="修改库存"]') ?? target.closest("a");
        const cell = trigger == null ? void 0 : trigger.closest('.ecom-g-table-cell[class*="style_totalInventory__"]');
        if (!trigger || !cell) {
          return;
        }
        if (this.mountSyncButton()) {
          return;
        }
        this.waitForMountSyncButton();
      };
      this.toast = options.toast ?? Toast;
    }
    init(root = document) {
      root.addEventListener("click", this.handleDocumentClick);
    }
    destroy(root = document) {
      root.removeEventListener("click", this.handleDocumentClick);
      this.stopMountObserver();
    }
    async sync() {
      await this.syncStock();
    }
    waitForMountSyncButton() {
      if (this.waitMountDispose) {
        return;
      }
      this.waitMountDispose = runWhenElementReady(EDIT_METHOD_HEADER_SELECTOR, () => {
        this.mountSyncButton();
        this.stopMountObserver();
      });
    }
    stopMountObserver() {
      var _a;
      (_a = this.waitMountDispose) == null ? void 0 : _a.call(this);
      this.waitMountDispose = void 0;
    }
    mountSyncButton() {
      const mountHost = findEditMethodHeader();
      if (!mountHost) {
        return false;
      }
      if (mountHost.querySelector(`:scope > ${CONTROL_GROUP_SELECTOR}`)) {
        return true;
      }
      const group = this.createSyncStockGroup();
      const tabs = mountHost.querySelector(EDIT_METHOD_TABS_SELECTOR);
      if ((tabs == null ? void 0 : tabs.parentElement) === mountHost) {
        tabs.insertAdjacentElement("afterend", group);
        return true;
      }
      mountHost.append(group);
      return true;
    }
    /**
     * 构造库存同步控制组。
     * 新版页面把库存编辑能力收进抽屉头部，因此这里同时创建勾选框和同步按钮，方便整体前插。
     */
    createSyncStockGroup() {
      const group = document.createElement("div");
      group.className = "ddt-product-list-sync-stock-group";
      group.style.display = INLINE_DISPLAY;
      group.style.alignItems = INLINE_ALIGN_CENTER;
      group.style.gap = CONTROL_GAP;
      const checkboxLabel = this.createClearUnmatchedCheckbox();
      const button = this.createSyncStockButton();
      group.append(checkboxLabel, button);
      return group;
    }
    /**
     * 创建“清空未匹配”勾选框。
     * 勾选状态继续保存在实例内，保证同一实例重复打开抽屉时维持用户上一次选择。
     */
    createClearUnmatchedCheckbox() {
      const checkboxLabel = document.createElement("label");
      checkboxLabel.style.display = INLINE_DISPLAY;
      checkboxLabel.style.alignItems = INLINE_ALIGN_CENTER;
      checkboxLabel.style.gap = CHECKBOX_GAP;
      checkboxLabel.style.fontSize = CHECKBOX_FONT_SIZE;
      checkboxLabel.style.lineHeight = CHECKBOX_LINE_HEIGHT;
      checkboxLabel.style.color = CHECKBOX_TEXT_COLOR;
      checkboxLabel.title = UNMATCHED_CHECKBOX_TITLE;
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "ddt-product-list-clear-unmatched";
      checkbox.checked = this.clearUnmatchedEnabled;
      checkbox.style.marginLeft = "10px";
      checkbox.title = UNMATCHED_CHECKBOX_TITLE;
      checkbox.addEventListener("change", () => {
        this.clearUnmatchedEnabled = checkbox.checked;
      });
      const checkboxText = document.createElement("span");
      checkboxText.textContent = "清空未匹配";
      checkboxText.title = UNMATCHED_CHECKBOX_TITLE;
      checkboxLabel.append(checkbox, checkboxText);
      return checkboxLabel;
    }
    /**
     * 创建库存同步按钮。
     * 继续复用共享内嵌按钮能力，保留旧类名以兼容现有测试和业务识别。
     */
    createSyncStockButton() {
      return createInlineButton({
        text: "同步库存",
        variant: "primary",
        size: "small",
        className: "ddt-product-list-sync-stock",
        loadingText: "同步中...",
        onClick: async () => {
          await this.syncStock();
        }
      });
    }
    async syncStock() {
      try {
        const rows = extractPopupTableRows(readPopupTableData());
        if (rows.length === 0) {
          throw new Error("未识别到库存弹窗数据");
        }
        const skuIds = [...new Set(rows.map((row) => row.baseSkuId).filter(Boolean))];
        const stockMap = await this.options.stockService.getProductInventory(skuIds);
        for (const row of rows) {
          const inventory = stockMap.get(row.code);
          if (!inventory) {
            this.handleUnmatchedRow(row);
            continue;
          }
          const writePayload = buildRowWritePayload(row.hasMultiTimeStocks, row.isPreSaleByHeader, inventory);
          row.applyCurrentStock(writePayload.currentStock);
          if (writePayload.purchaseStock !== void 0) {
            row.applyPurchaseStock(writePayload.purchaseStock);
          }
          row.commit();
        }
        this.toast.success("库存更新完成");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.options.logger.error("同步库存失败", error);
        this.toast.error(`同步库存失败: ${message}`);
      }
    }
    /**
     * 处理聚水潭库存未命中的行。
     * 当用户勾选“清空未匹配”时，当前行所有库存展示位都会被清零；
     * 否则保持旧行为，仅记录日志并跳过该行。
     */
    handleUnmatchedRow(row) {
      const payload = {
        baseSkuId: row.baseSkuId,
        code: row.code,
        hasMultiTimeStocks: row.hasMultiTimeStocks,
        isPreSaleByHeader: row.isPreSaleByHeader
      };
      if (!this.clearUnmatchedEnabled) {
        this.options.logger.debug("SKU 库存未命中，跳过当前行", payload);
        return;
      }
      row.applyCurrentStock(0);
      if (row.hasMultiTimeStocks) {
        row.applyPurchaseStock(0);
      }
      row.commit();
      this.options.logger.debug("SKU 库存未命中，已按清空未匹配置零", payload);
    }
  }
  function buildRowWritePayload(hasMultiTimeStocks, isPreSaleByHeader, inventory) {
    if (hasMultiTimeStocks) {
      const purchaseSyncStock = inventory.availableStock < 0 ? inventory.availableStock + inventory.purchaseStock : inventory.purchaseStock;
      return {
        currentStock: Math.max(0, inventory.availableStock),
        purchaseStock: Math.max(0, purchaseSyncStock)
      };
    }
    const currentStock = isPreSaleByHeader ? inventory.availableStock + inventory.purchaseStock : inventory.availableStock;
    return {
      currentStock: Math.max(0, currentStock)
    };
  }
  function readPopupTableData() {
    const drawer = findStockDrawerRoot();
    if (!drawer) {
      return [];
    }
    const skuCodeBySkuId = readSkuCodeBySkuId(drawer);
    for (const candidate of findStockDataFiberHosts(drawer)) {
      const fiber = findReactFiber(candidate);
      const data = readDataFromKnownPaths(fiber) ?? readDataFromObjectGraph(fiber);
      if (isPopupTableDataList(data)) {
        return mergeSkuCodes(data, skuCodeBySkuId);
      }
    }
    return [];
  }
  function findEditMethodHeader() {
    const drawer = findStockDrawerRoot();
    return (drawer == null ? void 0 : drawer.querySelector(EDIT_METHOD_HEADER_SELECTOR)) ?? void 0;
  }
  function findStockDataFiberHosts(drawer) {
    const selectors = [
      STOCK_TABLE_CONTAINER_SELECTOR,
      STOCK_TABLE_WRAPPER_SELECTOR,
      STOCK_DRAWER_CONTENT_SELECTOR,
      EDIT_METHOD_CONTAINER_SELECTOR,
      STOCK_DRAWER_BODY_SELECTOR
    ];
    const hosts = selectors.map((selector) => drawer.querySelector(selector)).filter((element) => Boolean(element));
    return uniqueElements([...hosts, drawer]);
  }
  function findStockDrawerRoot() {
    const drawers = Array.from(document.querySelectorAll(STOCK_DRAWER_SELECTOR));
    return drawers.find((drawer) => {
      var _a;
      const titleText = ((_a = drawer.querySelector(STOCK_DRAWER_TITLE_SELECTOR)) == null ? void 0 : _a.textContent) ?? "";
      return titleText.includes(STOCK_DRAWER_TITLE_TEXT);
    });
  }
  function findReactFiber(element) {
    const keys = Object.getOwnPropertyNames(element);
    for (const key of keys) {
      if (key.startsWith("__reactFiber$") || key.startsWith("__reactProps$")) {
        const value = element[key];
        if (value && typeof value === "object") {
          return value;
        }
      }
    }
    const values = Object.values(element);
    return values.find((value) => value && typeof value === "object");
  }
  function readSkuCodeBySkuId(drawer) {
    const result = /* @__PURE__ */ new Map();
    const cells = Array.from(drawer.querySelectorAll(STOCK_SKU_CELL_SELECTOR));
    for (const cell of cells) {
      const skuInfo = readSkuInfoFromCell(cell);
      const skuId = readStringField(skuInfo, "sku_id");
      const skuCode = readStringField(skuInfo, "sku_code");
      if (skuId && skuCode) {
        result.set(skuId, skuCode);
      }
    }
    return result;
  }
  function readSkuInfoFromCell(cell) {
    var _a, _b, _c, _d, _e;
    const props = findReactProps(cell);
    const skuInfo = asRecord$1((_e = (_d = (_c = (_b = (_a = props == null ? void 0 : props.children) == null ? void 0 : _a[1]) == null ? void 0 : _b.props) == null ? void 0 : _c.skuName) == null ? void 0 : _d.props) == null ? void 0 : _e.skuInfo);
    if (skuInfo) {
      return skuInfo;
    }
    return findInObjectGraph(props, (value) => {
      const record = asRecord$1(value);
      return readStringField(record, "sku_id") && readStringField(record, "sku_code") ? record : void 0;
    });
  }
  function findReactProps(element) {
    const key = Object.getOwnPropertyNames(element).find((name) => name.startsWith("__reactProps$"));
    const value = key ? element[key] : void 0;
    return asRecord$1(value);
  }
  function uniqueElements(elements) {
    return [...new Set(elements)];
  }
  function readDataFromObjectGraph(source) {
    return findInObjectGraph(source, (value) => {
      return isPopupTableDataList(value) ? value : void 0;
    });
  }
  function readDataFromKnownPaths(source) {
    return getArrayAtPath(source, LEGACY_TABLE_DATA_PATH) ?? getArrayAtPath(source, REAL_TABLE_DATA_PATH);
  }
  function isPopupTableDataList(value) {
    if (!Array.isArray(value) || value.length === 0) {
      return false;
    }
    return isLegacyPopupTableDataList(value) || isRealPopupTableDataList(value);
  }
  function isLegacyPopupTableDataList(value) {
    return value.every((item) => {
      var _a;
      const record = asRecord$1(item);
      if (!record || !Array.isArray(record.header)) {
        return false;
      }
      return typeof ((_a = asRecord$1(record.tableInfo)) == null ? void 0 : _a.fc) === "object";
    });
  }
  function isRealPopupTableDataList(value) {
    return value.every((item) => {
      const record = asRecord$1(item);
      return isBatchStockRow(record) || isSpotStockRow(record);
    });
  }
  function mergeSkuCodes(dataList, skuCodeBySkuId) {
    return dataList.map((item) => {
      const record = asRecord$1(item);
      const skuId = readRowSkuId(record);
      const skuCode = skuId ? skuCodeBySkuId.get(skuId) : void 0;
      return skuCode ? { ...record, skuCode } : item;
    });
  }
  function isBatchStockRow(record) {
    if (!readStringField(record, "skuId") || !asRecord$1(record == null ? void 0 : record.skuForm) || !asRecord$1(record == null ? void 0 : record.spotForm)) {
      return false;
    }
    return (record == null ? void 0 : record.presaleForms) === void 0 || Array.isArray(record.presaleForms);
  }
  function isSpotStockRow(record) {
    return Boolean(readSpotFormSkuId(record) && asRecord$1(record == null ? void 0 : record.form));
  }
  function readRowSkuId(record) {
    return readStringField(record, "skuId") || readSpotFormSkuId(record);
  }
  function readSpotFormSkuId(record) {
    const form = asRecord$1(record == null ? void 0 : record.form);
    const valueRef = asRecord$1(form == null ? void 0 : form.value);
    return readStringField(valueRef == null ? void 0 : valueRef.value, "sku_id");
  }
  function readStringField(source, key) {
    var _a;
    const value = (_a = asRecord$1(source)) == null ? void 0 : _a[key];
    return typeof value === "string" ? value : "";
  }
  class ProductListFeature {
    constructor(context, deps = {}) {
      this.context = context;
      this.stockSync = new ProductListStockSync({
        logger: context.logger,
        stockService: deps.stockService ?? new JuShuiTanStockService({
          appConfig: context.appConfig
        })
      });
    }
    init() {
      this.stockSync.init(document);
      this.context.logger.info("初始化功能：product-list");
    }
    destroy() {
      this.stockSync.destroy(document);
      this.context.logger.info("销毁功能：product-list");
    }
    async syncStock() {
      await this.stockSync.sync();
    }
  }
  const productListFeature = {
    id: "product-list",
    name: "商品列表增强",
    description: "库存弹窗、库存同步、批量标题替换",
    matches: [/fxg\.jinritemai\.com\/ffa\/g\/list/],
    defaultEnabled: true,
    create: (context) => new ProductListFeature(context)
  };
  class LiveControlFeature {
    constructor(logger) {
      this.logger = logger;
    }
    init() {
      this.logger.info("初始化空功能：live-control");
    }
    destroy() {
      this.logger.info("销毁空功能：live-control");
    }
  }
  const liveControlFeature = {
    id: "live-control",
    name: "直播控制台增强",
    description: "直播商品货号显示、自动讲解等行为",
    matches: [/ffa\/content-tool\/live\/control/],
    defaultEnabled: true,
    create: ({ logger }) => new LiveControlFeature(logger)
  };
  class LiveStockPreviewFeature {
    constructor(logger) {
      this.logger = logger;
    }
    init() {
      this.logger.info("初始化空功能：live-stock-preview");
    }
    destroy() {
      this.logger.info("销毁空功能：live-stock-preview");
    }
  }
  const liveStockPreviewFeature = {
    id: "live-stock-preview",
    name: "直播库存预览与直播预告",
    description: "查询直播商品库存，生成或发送直播预告内容",
    matches: [/fxg\.jinritemai\.com\/ffa\/content-tool\/live\/control/],
    defaultEnabled: true,
    create: ({ logger }) => new LiveStockPreviewFeature(logger)
  };
  function parseProductEditSizeInfo(sizeText) {
    const rawText = String(sizeText ?? "").trim();
    if (!rawText) {
      return null;
    }
    const rangeMatch = rawText.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
    if (rangeMatch) {
      const originalRangeText = `${rangeMatch[1]}-${rangeMatch[2]}`;
      const compactCodePart2 = `${rangeMatch[1]}${rangeMatch[2]}`.replace(/[^\d]/g, "");
      const priceKey2 = Number(compactCodePart2);
      if (!compactCodePart2 || !Number.isFinite(priceKey2)) {
        return null;
      }
      return {
        rawText,
        compactCodePart: compactCodePart2,
        priceKey: priceKey2,
        isRange: true,
        originalRangeText
      };
    }
    const singleMatch = rawText.match(/\d+(?:\.\d+)?/);
    if (!singleMatch) {
      return null;
    }
    const compactCodePart = singleMatch[0].replace(/[^\d]/g, "");
    const priceKey = Number(compactCodePart);
    if (!compactCodePart || !Number.isFinite(priceKey)) {
      return null;
    }
    return {
      rawText,
      compactCodePart,
      priceKey,
      isRange: false,
      originalRangeText: ""
    };
  }
  function buildDefaultProductEditPriceRules(sizeInfos) {
    const priceKeys = [...new Set(
      sizeInfos.map((sizeInfo) => sizeInfo == null ? void 0 : sizeInfo.priceKey).filter((value) => Number.isFinite(value))
    )].sort((left, right) => left - right);
    if (priceKeys.length === 0) {
      return [];
    }
    const currentMinSize = priceKeys[0];
    const currentMaxSize = priceKeys[priceKeys.length - 1];
    const hasEncodedRangeSize = sizeInfos.some((sizeInfo) => {
      if (!sizeInfo) {
        return false;
      }
      return sizeInfo.isRange || String(sizeInfo.priceKey).length >= 4;
    });
    if (hasEncodedRangeSize) {
      return [{
        minSize: currentMinSize,
        maxSize: currentMaxSize,
        price: ""
      }];
    }
    return [
      { minSize: Math.max(currentMinSize, currentMinSize), maxSize: Math.min(25, currentMaxSize), price: "" },
      { minSize: Math.max(26, currentMinSize), maxSize: Math.min(30, currentMaxSize), price: "" },
      { minSize: Math.max(31, currentMinSize), maxSize: Math.min(37, currentMaxSize), price: "" },
      { minSize: Math.max(38, currentMinSize), maxSize: Math.min(currentMaxSize, currentMaxSize), price: "" }
    ].filter((rule) => rule.minSize <= rule.maxSize);
  }
  function buildProductEditCode(params) {
    const { currentCode, prefix, suffix, sizeInfo, keepRangeHyphen } = params;
    if (prefix.trim()) {
      const sizeCodePart = keepRangeHyphen && sizeInfo.isRange && sizeInfo.originalRangeText ? sizeInfo.originalRangeText : sizeInfo.compactCodePart;
      return `${prefix}${sizeCodePart}${suffix}`;
    }
    if (suffix.trim()) {
      return `${currentCode}${suffix}`;
    }
    return currentCode;
  }
  function collectProductEditPriceRules(params) {
    const { currentMinSize, currentMaxSize, rows } = params;
    if (!Number.isFinite(currentMinSize) || !Number.isFinite(currentMaxSize)) {
      return {
        ok: false,
        message: "当前尺码数据无法解析，不能执行码段价格填写"
      };
    }
    const minSizeLimit = Number(currentMinSize);
    const maxSizeLimit = Number(currentMaxSize);
    const rules = [];
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const rowNo = index + 1;
      const minRaw = row.minSize.trim();
      const maxRaw = row.maxSize.trim();
      const priceRaw = row.price.trim();
      if (!priceRaw) {
        continue;
      }
      if (!minRaw || !maxRaw) {
        return {
          ok: false,
          message: `第${rowNo}行请完整填写最小尺码、最大尺码`
        };
      }
      const minSize = Number(minRaw);
      const maxSize = Number(maxRaw);
      const price = Number(priceRaw);
      if (!Number.isFinite(minSize) || !Number.isFinite(maxSize)) {
        return {
          ok: false,
          message: `第${rowNo}行尺码必须为数字`
        };
      }
      if (minSize < minSizeLimit || maxSize > maxSizeLimit) {
        return {
          ok: false,
          message: `第${rowNo}行尺码需在当前范围 ${minSizeLimit}-${maxSizeLimit} 内`
        };
      }
      if (minSize > maxSize) {
        return {
          ok: false,
          message: `第${rowNo}行最小尺码不能大于最大尺码`
        };
      }
      if (!Number.isFinite(price) || price < 0) {
        return {
          ok: false,
          message: `第${rowNo}行价格必须是非负数字`
        };
      }
      rules.push({
        minSize,
        maxSize,
        price: priceRaw
      });
    }
    const sortedRules = [...rules].sort((left, right) => left.minSize - right.minSize);
    for (let index = 1; index < sortedRules.length; index += 1) {
      if (sortedRules[index].minSize <= sortedRules[index - 1].maxSize) {
        return {
          ok: false,
          message: "码段区间不能重叠，请检查输入"
        };
      }
    }
    return {
      ok: true,
      rules
    };
  }
  function findMatchedProductEditPriceRule(priceKey, rules) {
    return rules.find((rule) => priceKey >= rule.minSize && priceKey <= rule.maxSize);
  }
  function replaceProductEditCode(params) {
    const { currentCode, originalText, replaceText, mode } = params;
    if (!currentCode || !originalText) {
      return currentCode;
    }
    if (mode === "any") {
      return currentCode.split(originalText).join(replaceText);
    }
    if (mode === "prefix") {
      if (!currentCode.startsWith(originalText)) {
        return currentCode;
      }
      return `${replaceText}${currentCode.slice(originalText.length)}`;
    }
    if (mode === "suffix") {
      if (!currentCode.endsWith(originalText)) {
        return currentCode;
      }
      return `${currentCode.slice(0, currentCode.length - originalText.length)}${replaceText}`;
    }
    return currentCode;
  }
  function openProductEditModal(options) {
    const toast = options.toast ?? Toast;
    const sizeInfoMap = buildSizeInfoMap(options.model);
    const content = document.createElement("div");
    content.className = "ddt-product-edit-modal";
    content.style.display = "flex";
    content.style.flexDirection = "column";
    content.style.gap = "12px";
    const tabs = createTabs();
    const codePanel = createCodePanel(options.model, sizeInfoMap);
    const pricePanel = createPricePanel(options.model, sizeInfoMap);
    const replacePanel = createReplacePanel();
    content.append(tabs.container, codePanel, pricePanel, replacePanel);
    const footer = document.createElement("div");
    footer.style.display = "flex";
    footer.style.justifyContent = "flex-end";
    footer.style.gap = "8px";
    let activeTab = "code";
    let modalInstance;
    const cancelButton = createButton({
      text: "取消",
      variant: "secondary",
      size: "small",
      onClick: () => {
        modalInstance.close();
      }
    });
    const submitButton = createButton({
      text: "确定",
      variant: "primary",
      size: "small",
      onClick: () => {
        const success = activeTab === "code" ? applyCodeFill(options.model, codePanel, sizeInfoMap, toast) : activeTab === "price" ? applyPriceFill(options.model, pricePanel, sizeInfoMap, toast) : applyCodeReplace(options.model, replacePanel, toast);
        if (success) {
          modalInstance.close();
        }
      }
    });
    submitButton.classList.add("ddt-product-edit-submit");
    footer.append(cancelButton, submitButton);
    modalInstance = openModal({
      title: "快速填写商品信息",
      width: 760,
      content,
      footer
    });
    const switchTab = (nextTab) => {
      activeTab = nextTab;
      syncTabButtonState(tabs.buttons.code, nextTab === "code");
      syncTabButtonState(tabs.buttons.price, nextTab === "price");
      syncTabButtonState(tabs.buttons.replace, nextTab === "replace");
      codePanel.style.display = nextTab === "code" ? "block" : "none";
      pricePanel.style.display = nextTab === "price" ? "block" : "none";
      replacePanel.style.display = nextTab === "replace" ? "block" : "none";
    };
    tabs.buttons.code.addEventListener("click", () => switchTab("code"));
    tabs.buttons.price.addEventListener("click", () => switchTab("price"));
    tabs.buttons.replace.addEventListener("click", () => switchTab("replace"));
    switchTab("code");
    options.logger.debug("打开商品编辑增强弹窗", {
      rowCount: options.model.rows.length,
      colorCount: options.model.colors.length,
      sizeCount: options.model.sizes.length
    });
    return modalInstance;
  }
  function createTabs() {
    const container = document.createElement("div");
    container.style.display = "flex";
    container.style.gap = "8px";
    const code = createTabButton("商品编码", "code");
    const price = createTabButton("码段价格", "price");
    const replace = createTabButton("编码替换", "replace");
    container.append(code, price, replace);
    return {
      container,
      buttons: {
        code,
        price,
        replace
      }
    };
  }
  function createTabButton(text, tab) {
    const button = createButton({
      text,
      variant: "secondary",
      size: "small"
    });
    button.dataset.tab = tab;
    return button;
  }
  function syncTabButtonState(button, active) {
    button.dataset.active = String(active);
    button.style.backgroundColor = active ? "rgb(22, 119, 255)" : "rgb(255, 255, 255)";
    button.style.borderColor = active ? "rgb(22, 119, 255)" : "rgb(208, 211, 216)";
    button.style.color = active ? "rgb(255, 255, 255)" : "rgb(31, 35, 41)";
  }
  function createCodePanel(model, sizeInfoMap) {
    const panel = document.createElement("div");
    panel.style.display = "block";
    const hasRangeSize = [...sizeInfoMap.values()].some((sizeInfo) => sizeInfo.isRange);
    if (hasRangeSize) {
      const keepLabel = document.createElement("label");
      keepLabel.style.display = "inline-flex";
      keepLabel.style.alignItems = "center";
      keepLabel.style.gap = "6px";
      keepLabel.style.marginBottom = "12px";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "ddt-product-edit-keep-size-hyphen";
      const text = document.createElement("span");
      text.textContent = "连接尺码保留连接符（如 23-24）";
      keepLabel.append(checkbox, text);
      panel.append(keepLabel);
    }
    panel.append(createCodeHeader());
    const table = document.createElement("div");
    table.style.display = "flex";
    table.style.flexDirection = "column";
    table.style.gap = "12px";
    for (const color of model.colors) {
      const colorRows = model.rows.filter((row) => row.colorId === color.id);
      if (colorRows.length === 0) {
        continue;
      }
      const card = document.createElement("div");
      card.className = "ddt-product-edit-code-card";
      card.dataset.colorId = color.id;
      card.style.display = "flex";
      card.style.flexDirection = "column";
      card.style.border = "1px solid #d9d9d9";
      card.style.borderRadius = "8px";
      card.style.overflow = "hidden";
      const uniqueTimeIds = [...new Set(colorRows.map((row) => row.timeId))];
      uniqueTimeIds.forEach((timeId, index) => {
        var _a;
        const isFirstTimeRow = index === 0;
        const suffix = createTextInput({
          type: "text",
          placeholder: "输入后缀",
          className: "ddt-product-edit-time-suffix"
        });
        suffix.dataset.colorId = color.id;
        suffix.dataset.timeId = timeId;
        const prefix = isFirstTimeRow ? createTextInput({
          type: "text",
          placeholder: "输入前缀",
          className: "ddt-product-edit-prefix"
        }) : void 0;
        if (prefix) {
          prefix.dataset.colorId = color.id;
        }
        card.append(createCodeFieldRow({
          colorName: isFirstTimeRow ? color.name : "",
          prefixInput: prefix,
          timeName: ((_a = model.times.find((item) => item.id === timeId)) == null ? void 0 : _a.name) ?? timeId,
          suffixInput: suffix,
          hasBottomBorder: index < uniqueTimeIds.length - 1
        }));
      });
      table.append(card);
    }
    panel.append(table);
    return panel;
  }
  function createCodeHeader() {
    const header = document.createElement("div");
    header.className = "ddt-product-edit-code-header";
    header.style.display = "grid";
    header.style.gridTemplateColumns = getCodeGridTemplateColumns();
    header.style.gap = "10px";
    header.style.alignItems = "center";
    header.style.marginBottom = "12px";
    header.style.padding = "8px 12px";
    header.style.borderRadius = "8px";
    header.style.background = "#f5f7fa";
    header.style.color = "#4e5969";
    header.style.fontSize = "12px";
    header.style.fontWeight = "600";
    for (const labelText of ["颜色分类", "前缀", "发货时间", "后缀"]) {
      const cell = document.createElement("div");
      cell.className = "ddt-product-edit-code-header-cell";
      cell.textContent = labelText;
      header.append(cell);
    }
    return header;
  }
  function createCodeFieldRow(options) {
    const row = document.createElement("div");
    row.className = "ddt-product-edit-code-row";
    row.style.display = "grid";
    row.style.gridTemplateColumns = getCodeGridTemplateColumns();
    row.style.alignItems = "center";
    row.style.gap = "10px";
    row.style.padding = "10px 12px";
    row.style.background = "#ffffff";
    if (options.hasBottomBorder) {
      row.style.borderBottom = "1px solid #eef0f3";
    }
    row.append(
      createCodeCell(options.colorName, { bold: Boolean(options.colorName) }),
      createCodeCell(options.prefixInput),
      createCodeCell(options.timeName),
      createCodeCell(options.suffixInput)
    );
    return row;
  }
  function createCodeCell(content, options = {}) {
    const cell = document.createElement("div");
    cell.className = "ddt-product-edit-code-cell";
    cell.style.minWidth = "0";
    cell.style.color = "#1f2329";
    cell.style.fontSize = "13px";
    cell.style.lineHeight = "20px";
    if (options.bold) {
      cell.style.fontWeight = "600";
    }
    if (typeof content === "string") {
      cell.textContent = content;
      return cell;
    }
    if (content) {
      cell.append(content);
    }
    return cell;
  }
  function getCodeGridTemplateColumns() {
    return "minmax(120px, 1fr) minmax(160px, 1.3fr) minmax(120px, 1fr) minmax(160px, 1.3fr)";
  }
  function createPricePanel(model, sizeInfoMap) {
    const panel = document.createElement("div");
    panel.style.display = "none";
    const priceSummary = document.createElement("div");
    const sizeInfos = [...sizeInfoMap.values()];
    const priceKeys = sizeInfos.map((item) => item.priceKey).sort((left, right) => left - right);
    const minSize = priceKeys[0];
    const maxSize = priceKeys[priceKeys.length - 1];
    priceSummary.textContent = Number.isFinite(minSize) && Number.isFinite(maxSize) ? `当前尺码范围：${minSize}-${maxSize}` : "当前尺码范围：未解析到可用尺码";
    priceSummary.style.marginBottom = "8px";
    panel.append(priceSummary);
    const checkboxRow = document.createElement("div");
    checkboxRow.style.display = "flex";
    checkboxRow.style.flexWrap = "wrap";
    checkboxRow.style.gap = "12px";
    checkboxRow.style.marginBottom = "12px";
    for (const color of model.colors) {
      const label = document.createElement("label");
      label.style.display = "inline-flex";
      label.style.alignItems = "center";
      label.style.gap = "4px";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "ddt-product-edit-price-color";
      checkbox.dataset.colorId = color.id;
      checkbox.checked = true;
      const text = document.createElement("span");
      text.textContent = color.name;
      label.append(checkbox, text);
      checkboxRow.append(label);
    }
    panel.append(checkboxRow);
    const rowsContainer = document.createElement("div");
    rowsContainer.className = "ddt-product-edit-price-rows";
    rowsContainer.style.display = "flex";
    rowsContainer.style.flexDirection = "column";
    rowsContainer.style.gap = "8px";
    panel.append(rowsContainer);
    const defaultRules = buildDefaultProductEditPriceRules(sizeInfos);
    if (defaultRules.length === 0) {
      rowsContainer.append(createPriceRuleRow());
    } else {
      for (const rule of defaultRules) {
        rowsContainer.append(createPriceRuleRow(rule));
      }
    }
    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.justifyContent = "flex-end";
    actions.style.gap = "8px";
    actions.style.marginTop = "8px";
    const addButton = createButton({
      text: "添加行",
      variant: "secondary",
      size: "small",
      onClick: () => {
        rowsContainer.append(createPriceRuleRow());
      }
    });
    const clearButton = createButton({
      text: "清空",
      variant: "secondary",
      size: "small",
      onClick: () => {
        rowsContainer.innerHTML = "";
        rowsContainer.append(createPriceRuleRow());
      }
    });
    actions.append(addButton, clearButton);
    panel.append(actions);
    return panel;
  }
  function createPriceRuleRow(rule) {
    const row = document.createElement("div");
    row.className = "ddt-product-edit-price-row";
    row.style.display = "grid";
    row.style.gridTemplateColumns = "1fr 1fr 1fr auto";
    row.style.gap = "8px";
    const minInput = createTextInput({
      type: "number",
      className: "ddt-product-edit-price-min",
      value: rule ? String(rule.minSize) : "",
      placeholder: "最小尺码"
    });
    const maxInput = createTextInput({
      type: "number",
      className: "ddt-product-edit-price-max",
      value: rule ? String(rule.maxSize) : "",
      placeholder: "最大尺码"
    });
    const priceInput = createTextInput({
      type: "number",
      className: "ddt-product-edit-price-value",
      value: (rule == null ? void 0 : rule.price) ?? "",
      placeholder: "价格"
    });
    const deleteButton = createButton({
      text: "删除",
      variant: "secondary",
      size: "small",
      onClick: () => {
        row.remove();
      }
    });
    row.append(minInput, maxInput, priceInput, deleteButton);
    return row;
  }
  function createReplacePanel() {
    const panel = document.createElement("div");
    panel.style.display = "none";
    const modeRow = document.createElement("div");
    modeRow.style.display = "flex";
    modeRow.style.gap = "12px";
    modeRow.style.marginBottom = "12px";
    modeRow.append(
      createReplaceModeLabel("不限", "any", false),
      createReplaceModeLabel("前缀", "prefix", false),
      createReplaceModeLabel("后缀", "suffix", true)
    );
    const inputRow = document.createElement("div");
    inputRow.style.display = "grid";
    inputRow.style.gridTemplateColumns = "1fr 1fr";
    inputRow.style.gap = "8px";
    const original = createTextInput({
      type: "text",
      placeholder: "输入原内容",
      value: "=="
    });
    original.id = "ddt-product-edit-replace-original";
    const next = createTextInput({
      type: "text",
      placeholder: "输入替换内容"
    });
    next.id = "ddt-product-edit-replace-next";
    inputRow.append(original, next);
    panel.append(modeRow, inputRow);
    return panel;
  }
  function createReplaceModeLabel(text, mode, checked) {
    const label = document.createElement("label");
    label.style.display = "inline-flex";
    label.style.alignItems = "center";
    label.style.gap = "4px";
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "ddt-product-edit-replace-mode";
    radio.value = mode;
    radio.checked = checked;
    const span = document.createElement("span");
    span.textContent = text;
    label.append(radio, span);
    return label;
  }
  function applyCodeFill(model, panel, sizeInfoMap, toast) {
    var _a;
    const keepRangeHyphen = ((_a = panel.querySelector(".ddt-product-edit-keep-size-hyphen")) == null ? void 0 : _a.checked) ?? false;
    const prefixMap = /* @__PURE__ */ new Map();
    const suffixMap = /* @__PURE__ */ new Map();
    let appliedCount = 0;
    let skippedCount = 0;
    panel.querySelectorAll(".ddt-product-edit-prefix").forEach((input) => {
      prefixMap.set(input.dataset.colorId ?? "", input.value.trim());
    });
    panel.querySelectorAll(".ddt-product-edit-time-suffix").forEach((input) => {
      suffixMap.set(`${input.dataset.colorId ?? ""}:${input.dataset.timeId ?? ""}`, input.value.trim());
    });
    for (const row of model.rows) {
      const prefix = prefixMap.get(row.colorId) ?? "";
      const suffix = suffixMap.get(`${row.colorId}:${row.timeId}`) ?? "";
      if (!prefix && !suffix) {
        continue;
      }
      const sizeInfo = sizeInfoMap.get(row.sizeId);
      if (!sizeInfo) {
        continue;
      }
      if (!row.canSetCode || !row.setCode) {
        skippedCount += 1;
        continue;
      }
      row.setCode(buildProductEditCode({
        currentCode: row.currentCode,
        prefix,
        suffix,
        sizeInfo,
        keepRangeHyphen
      }));
      appliedCount += 1;
    }
    if (appliedCount === 0 && skippedCount > 0) {
      toast.error("当前商品编码页没有可写回的 SKU 行");
      return false;
    }
    if (skippedCount > 0) {
      toast.warning(`已跳过 ${skippedCount} 行，原因：未识别到商品编码写回能力`);
    }
    return true;
  }
  function applyPriceFill(model, panel, sizeInfoMap, toast) {
    const sizeInfos = [...sizeInfoMap.values()];
    const priceKeys = sizeInfos.map((item) => item.priceKey).sort((left, right) => left - right);
    const currentMinSize = priceKeys[0] ?? null;
    const currentMaxSize = priceKeys[priceKeys.length - 1] ?? null;
    let appliedCount = 0;
    let skippedCount = 0;
    const rows = [...panel.querySelectorAll(".ddt-product-edit-price-row")].map((row) => {
      var _a, _b, _c;
      return {
        minSize: ((_a = row.querySelector(".ddt-product-edit-price-min")) == null ? void 0 : _a.value) ?? "",
        maxSize: ((_b = row.querySelector(".ddt-product-edit-price-max")) == null ? void 0 : _b.value) ?? "",
        price: ((_c = row.querySelector(".ddt-product-edit-price-value")) == null ? void 0 : _c.value) ?? ""
      };
    });
    const result = collectProductEditPriceRules({
      currentMinSize,
      currentMaxSize,
      rows
    });
    if (!result.ok) {
      toast.error(result.message);
      return false;
    }
    const selectedColorIds = new Set(
      [...panel.querySelectorAll(".ddt-product-edit-price-color")].filter((input) => input.checked).map((input) => input.dataset.colorId ?? "").filter(Boolean)
    );
    if (result.rules.length > 0 && selectedColorIds.size === 0) {
      toast.error("请至少选择一个颜色分类");
      return false;
    }
    for (const row of model.rows) {
      if (result.rules.length > 0 && !selectedColorIds.has(row.colorId)) {
        continue;
      }
      const sizeInfo = sizeInfoMap.get(row.sizeId);
      if (!sizeInfo) {
        continue;
      }
      const matchedRule = findMatchedProductEditPriceRule(sizeInfo.priceKey, result.rules);
      if (matchedRule) {
        if (!row.canSetPrice || !row.setPrice) {
          skippedCount += 1;
          continue;
        }
        row.setPrice(matchedRule.price);
        appliedCount += 1;
      }
    }
    if (appliedCount === 0 && skippedCount > 0) {
      toast.error("当前码段价格页没有可写回的 SKU 行");
      return false;
    }
    if (skippedCount > 0) {
      toast.warning(`已跳过 ${skippedCount} 行，原因：未识别到价格写回能力`);
    }
    return true;
  }
  function applyCodeReplace(model, panel, toast) {
    var _a, _b, _c;
    const originalText = ((_a = panel.querySelector("#ddt-product-edit-replace-original")) == null ? void 0 : _a.value.trim()) ?? "";
    const replaceText = ((_b = panel.querySelector("#ddt-product-edit-replace-next")) == null ? void 0 : _b.value.trim()) ?? "";
    const mode = ((_c = panel.querySelector('input[name="ddt-product-edit-replace-mode"]:checked')) == null ? void 0 : _c.value) ?? "suffix";
    if (!originalText) {
      toast.error("请输入原内容");
      return false;
    }
    let appliedCount = 0;
    let skippedCount = 0;
    for (const row of model.rows) {
      const nextCode = replaceProductEditCode({
        currentCode: row.currentCode,
        originalText,
        replaceText,
        mode
      });
      if (nextCode !== row.currentCode) {
        if (!row.canSetCode || !row.setCode) {
          skippedCount += 1;
          continue;
        }
        row.setCode(nextCode);
        appliedCount += 1;
      }
    }
    if (appliedCount === 0 && skippedCount > 0) {
      toast.error("当前编码替换页没有可写回的 SKU 行");
      return false;
    }
    if (skippedCount > 0) {
      toast.warning(`已跳过 ${skippedCount} 行，原因：未识别到商品编码写回能力`);
    }
    return true;
  }
  function buildSizeInfoMap(model) {
    const map = /* @__PURE__ */ new Map();
    for (const size of model.sizes) {
      const parsed = parseProductEditSizeInfo(size.name);
      if (parsed) {
        map.set(size.id, parsed);
      }
    }
    return map;
  }
  const defaultProductEditTimeId = "__default_time__";
  function readProductEditPageModel(root = document) {
    const table = findSkuTable(root);
    if (!table) {
      return {
        ok: false,
        message: "未找到商品编辑 SKU 表格"
      };
    }
    const rawRows = readSkuTableRows(table);
    if (!rawRows || rawRows.length === 0) {
      return {
        ok: false,
        message: "未识别到商品编辑 SKU 行数据"
      };
    }
    const colors = readSpecOptions(root, "#skuValue-颜色分类");
    if (colors.length === 0) {
      return {
        ok: false,
        message: "未识别到颜色分类数据"
      };
    }
    const sizes = readSpecOptions(root, "#skuValue-鞋码大小");
    if (sizes.length === 0) {
      return {
        ok: false,
        message: "未识别到鞋码大小数据"
      };
    }
    const rows = [];
    for (const rawRow of rawRows) {
      const parsedRow = parseSkuRow(rawRow);
      if (!parsedRow) {
        return {
          ok: false,
          message: "未识别到商品编辑表格写回能力"
        };
      }
      rows.push(parsedRow);
    }
    if (rows.every((row) => !row.canSetCode && !row.canSetPrice)) {
      return {
        ok: false,
        message: "未识别到任何商品编辑表格写回能力"
      };
    }
    const times = buildTimeOptions(root, rows);
    return {
      ok: true,
      model: {
        rows,
        colors,
        sizes,
        times
      }
    };
  }
  function findSkuTable(root) {
    const tables = root.querySelectorAll("div.ecom-g-table-container");
    return [...tables].find((table) => {
      var _a;
      return (_a = table.textContent) == null ? void 0 : _a.includes("颜色分类");
    });
  }
  function readSkuTableRows(table) {
    const reactSource = findReactSource(table);
    if (!reactSource) {
      return void 0;
    }
    return getArrayAtPath(reactSource, ["memoizedProps", "children", "props", "children", 1, "props", "data"]) ?? findInObjectGraph(reactSource, (value) => {
      if (!Array.isArray(value) || value.length === 0) {
        return void 0;
      }
      return value.every(isSkuRowLike) ? value : void 0;
    });
  }
  function readSpecOptions(root, selector) {
    const element = root.querySelector(selector);
    const reactSource = element ? findReactSource(element) : void 0;
    if (!reactSource) {
      return [];
    }
    const options = getArrayAtPath(reactSource, ["memoizedProps", "children", "props", "form", "value", "_value"]) ?? findInObjectGraph(reactSource, (value) => {
      if (!Array.isArray(value)) {
        return void 0;
      }
      return value.every(isOptionLike) ? value : void 0;
    });
    if (!options) {
      return [];
    }
    return options.map((option) => {
      var _a, _b;
      return {
        id: String(((_a = asRecord$1(option)) == null ? void 0 : _a.id) ?? ""),
        name: String(((_b = asRecord$1(option)) == null ? void 0 : _b.name) ?? "")
      };
    }).filter((option) => option.id && option.name);
  }
  function buildTimeOptions(root, rows) {
    var _a;
    const timeElement = root.querySelector('div[class*="style_timeSpecCheckboxGroup__"]');
    const reactSource = timeElement ? findReactSource(timeElement) : void 0;
    const timeLabels = reactSource ? getArrayAtPath(reactSource, ["memoizedProps", "children", "props", "value", "value"]) ?? findInObjectGraph(reactSource, (value) => {
      if (!Array.isArray(value) || value.length === 0) {
        return void 0;
      }
      return value.every((item) => typeof item === "string") ? value : void 0;
    }) : void 0;
    const timeMap = /* @__PURE__ */ new Map();
    if (Array.isArray(timeLabels) && timeLabels.length > 0) {
      rows.forEach((row, index) => {
        const label = timeLabels[index];
        if (typeof label === "string" && label.trim() && !timeMap.has(row.timeId)) {
          timeMap.set(row.timeId, label.trim());
        }
      });
    }
    if (timeMap.size === 0 && ((_a = rows[0]) == null ? void 0 : _a.timeId)) {
      timeMap.set(rows[0].timeId, "现货");
    }
    return [...timeMap.entries()].map(([id, name]) => ({ id, name }));
  }
  function parseSkuRow(rawRow) {
    const specIds = getArrayAtPath(rawRow, ["form", "value", "_value", "spec_detail_ids"]);
    const codeSetter = getSetterAtPath(rawRow, ["form", "children", "code", "value", "_setter"]);
    const priceSetter = getSetterAtPath(rawRow, ["form", "children", "price", "value", "_setter"]);
    if (!Array.isArray(specIds) || specIds.length < 2) {
      return void 0;
    }
    const code = readStringAtPath(rawRow, ["form", "value", "_value", "code"]);
    const price = readStringAtPath(rawRow, ["form", "value", "_value", "price"]);
    return {
      colorId: String(specIds[0] ?? ""),
      sizeId: String(specIds[1] ?? ""),
      timeId: String(specIds[2] ?? defaultProductEditTimeId),
      currentCode: code,
      currentPrice: price,
      canSetCode: Boolean(codeSetter),
      canSetPrice: Boolean(priceSetter),
      setCode: codeSetter,
      setPrice: priceSetter
    };
  }
  function getSetterAtPath(source, path) {
    let current = source;
    for (const key of path) {
      if (typeof key === "number") {
        if (!Array.isArray(current)) {
          return void 0;
        }
        current = current[key];
        continue;
      }
      const record = asRecord$1(current);
      if (!record) {
        return void 0;
      }
      current = record[key];
    }
    return typeof current === "function" ? current : void 0;
  }
  function readStringAtPath(source, path) {
    let current = source;
    for (const key of path) {
      if (typeof key === "number") {
        if (!Array.isArray(current)) {
          return "";
        }
        current = current[key];
        continue;
      }
      const record = asRecord$1(current);
      if (!record) {
        return "";
      }
      current = record[key];
    }
    return typeof current === "string" ? current : current == null ? "" : String(current);
  }
  function findReactSource(element) {
    for (const key of Object.getOwnPropertyNames(element)) {
      if (!key.startsWith("__reactFiber$") && !key.startsWith("__reactProps$")) {
        continue;
      }
      const value = element[key];
      if (value && typeof value === "object") {
        return value;
      }
    }
    return Object.values(element).find((value) => value && typeof value === "object");
  }
  function isOptionLike(value) {
    const record = asRecord$1(value);
    return typeof (record == null ? void 0 : record.id) !== "undefined" && typeof (record == null ? void 0 : record.name) !== "undefined";
  }
  function isSkuRowLike(value) {
    return Array.isArray(getArrayAtPath(value, ["form", "value", "_value", "spec_detail_ids"]));
  }
  class ProductEditFeature {
    constructor(context, deps = {}) {
      this.context = context;
      this.destroyed = false;
      this.handleButtonClick = () => {
        var _a;
        const result = this.readPageModel(document);
        if (!result.ok) {
          this.context.logger.warn("商品编辑页数据读取失败", {
            message: result.message
          });
          this.toast.error(result.message);
          return;
        }
        (_a = this.currentModal) == null ? void 0 : _a.close();
        this.currentModal = this.openModal({
          model: result.model,
          logger: this.context.logger,
          toast: this.toast
        });
      };
      this.readPageModel = deps.readPageModel ?? readProductEditPageModel;
      this.openModal = deps.openModal ?? openProductEditModal;
      this.toast = deps.toast ?? Toast;
    }
    init() {
      ensureUiTheme();
      this.destroyed = false;
      this.waitForMountHost();
      this.context.logger.info("初始化功能：product-edit");
    }
    destroy() {
      var _a, _b, _c;
      this.destroyed = true;
      (_a = this.hostReadyDispose) == null ? void 0 : _a.call(this);
      this.hostReadyDispose = void 0;
      (_b = this.currentModal) == null ? void 0 : _b.close();
      this.currentModal = void 0;
      (_c = this.toolbar) == null ? void 0 : _c.remove();
      this.toolbar = void 0;
      this.button = void 0;
      this.context.logger.info("销毁功能：product-edit");
    }
    waitForMountHost() {
      if (this.hostReadyDispose) {
        return;
      }
      this.hostReadyDispose = runWhenElementReady("#full-screen-card", (host) => {
        this.mountTrigger(host);
        this.hostReadyDispose = void 0;
      });
      this.context.disposables.add(() => {
        var _a;
        return (_a = this.hostReadyDispose) == null ? void 0 : _a.call(this);
      });
    }
    mountTrigger(host) {
      var _a, _b;
      if (this.destroyed || ((_a = this.toolbar) == null ? void 0 : _a.isConnected) || ((_b = this.button) == null ? void 0 : _b.isConnected)) {
        return;
      }
      const existingToolbar = host.querySelector(".ddt-product-edit-toolbar");
      const existingButton = existingToolbar == null ? void 0 : existingToolbar.querySelector(".ddt-product-edit-trigger");
      if (existingToolbar && existingButton) {
        this.toolbar = existingToolbar;
        this.button = existingButton;
        return;
      }
      const toolbar = document.createElement("div");
      toolbar.className = "ddt-product-edit-toolbar";
      toolbar.style.width = "100%";
      toolbar.style.height = "40px";
      const button = createInlineButton({
        text: "快速填写",
        variant: "primary",
        size: "small",
        align: "right",
        offsetTop: 4,
        className: "ddt-product-edit-trigger",
        onClick: () => {
          this.handleButtonClick();
        }
      });
      toolbar.append(button);
      host.prepend(toolbar);
      this.toolbar = toolbar;
      this.button = button;
    }
  }
  const productEditFeature = {
    id: "product-edit",
    name: "商品编辑增强",
    description: "商品编码快速填写、码段价格批量填写与编码替换",
    matches: [/fxg\.jinritemai\.com\/ffa\/g\/create/],
    defaultEnabled: true,
    create: (context) => new ProductEditFeature(context)
  };
  class LiveScreenFeature {
    constructor(logger) {
      this.logger = logger;
    }
    init() {
      this.logger.info("初始化空功能：live-screen");
    }
    destroy() {
      this.logger.info("销毁空功能：live-screen");
    }
  }
  const liveScreenFeature = {
    id: "live-screen",
    name: "直播大屏数据登记",
    description: "采集并登记直播大屏数据",
    matches: [/\/screen\/live\/shop/],
    defaultEnabled: true,
    create: ({ logger }) => new LiveScreenFeature(logger)
  };
  class FeishuClient {
    constructor(options) {
      this.tokenExpireAt = 0;
      this.appId = options.appId;
      this.appSecret = options.appSecret;
      this.baseUrl = options.baseUrl ?? "https://open.feishu.cn/open-apis";
      this.request = options.request ?? request;
    }
    async getTenantAccessToken() {
      this.ensureInitialized();
      const now = Date.now();
      if (this.cachedToken && this.tokenExpireAt > now + 5 * 60 * 1e3) {
        return this.cachedToken;
      }
      const response = await this.request({
        method: "POST",
        url: `${this.baseUrl}/auth/v3/tenant_access_token/internal`,
        headers: { "Content-Type": "application/json; charset=utf-8" },
        data: {
          app_id: this.appId,
          app_secret: this.appSecret
        }
      });
      const result = parseJson$1(response.text);
      if (result.code !== 0 || !result.tenant_access_token) {
        throw new Error(`获取飞书 tenant_access_token 失败: ${result.msg ?? "未知错误"}`);
      }
      this.cachedToken = result.tenant_access_token;
      this.tokenExpireAt = now + (result.expire ?? 0) * 1e3;
      return result.tenant_access_token;
    }
    getBaseUrl() {
      return this.baseUrl;
    }
    getRequest() {
      return this.request;
    }
    ensureInitialized() {
      if (!this.appId || !this.appSecret) {
        throw new Error("请先配置飞书 App ID 和 App Secret");
      }
    }
  }
  function parseJson$1(text) {
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("飞书接口返回不是合法 JSON");
    }
  }
  class FeishuSheet {
    constructor(client) {
      this.client = client;
    }
    async readRange(spreadsheetToken, range, options = {}) {
      var _a, _b;
      const token = await this.client.getTenantAccessToken();
      const query = new URLSearchParams();
      appendQuery(query, "valueRenderOption", options.valueRenderOption);
      appendQuery(query, "dateTimeRenderOption", options.dateTimeRenderOption);
      appendQuery(query, "user_id_type", options.user_id_type);
      const queryString = query.toString();
      const response = await this.client.getRequest()({
        method: "GET",
        url: `${this.client.getBaseUrl()}/sheets/v2/spreadsheets/${spreadsheetToken}/values/${encodeURIComponent(range)}${queryString ? `?${queryString}` : ""}`,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=utf-8"
        }
      });
      const result = parseFeishuSheetResponse(response);
      return ((_b = (_a = result.data) == null ? void 0 : _a.valueRange) == null ? void 0 : _b.values) ?? [];
    }
    async writeRange(spreadsheetToken, range, values) {
      const token = await this.client.getTenantAccessToken();
      const response = await this.client.getRequest()({
        method: "PUT",
        url: `${this.client.getBaseUrl()}/sheets/v2/spreadsheets/${spreadsheetToken}/values`,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=utf-8"
        },
        data: {
          valueRange: {
            range,
            values
          }
        }
      });
      parseFeishuSheetResponse(response);
    }
  }
  function appendQuery(query, name, value) {
    if (value) {
      query.append(name, value);
    }
  }
  function parseFeishuSheetResponse(response) {
    const result = parseJson$1(response.text);
    if (result.code !== 0) {
      throw new Error(`飞书表格接口请求失败: ${result.msg ?? "未知错误"}`);
    }
    return result;
  }
  const defaultPageCount = 10;
  function parseFollowShopNames(raw) {
    if (typeof raw !== "string") {
      return /* @__PURE__ */ new Set();
    }
    return new Set(
      raw.split(/[,，\n\r]+/).map((item) => item.trim()).filter(Boolean)
    );
  }
  function parseShopRankRows(json) {
    const rows = getPath(json, [
      "data",
      "module_data",
      "search_shop_rank",
      "compass_general_table_value",
      "data"
    ]);
    if (!Array.isArray(rows)) {
      return [];
    }
    const items = [];
    for (const row of rows) {
      const cellInfo = getObject(row, "cell_info");
      if (!cellInfo) continue;
      const name = getPath(cellInfo, ["shop", "shop", "shop_name"]);
      const rank = toFiniteNumber(getPath(cellInfo, ["rank", "index_values", "value", "value"]));
      if (!name || rank === void 0) {
        continue;
      }
      const item = {
        name,
        rank,
        rankText: String(rank),
        isSelf: getPath(cellInfo, ["is_self", "value", "value"]) === 1,
        payAmt: formatMetricCell(getObject(cellInfo, "pay_amt")),
        payCnt: formatMetricCell(getObject(cellInfo, "pay_cnt")),
        payUcnt: formatMetricCell(getObject(cellInfo, "pay_ucnt")),
        payUserUnitPrice: formatMetricCell(getObject(cellInfo, "pay_user_unit_price")),
        productClickPayRatio: formatMetricCell(getObject(cellInfo, "product_click_pay_ratio")),
        productClickUcnt: formatMetricCell(getObject(cellInfo, "product_click_ucnt")),
        productShowClickRatio: formatMetricCell(getObject(cellInfo, "product_show_click_ratio")),
        productShowUcnt: formatMetricCell(getObject(cellInfo, "product_show_ucnt"))
      };
      items.push(removeUndefinedItemFields(item));
    }
    return items;
  }
  function mergeShopRankItems(target, items, followShopNames) {
    for (const item of items) {
      if (followShopNames.size > 0 && !followShopNames.has(item.name) && !item.isSelf) {
        continue;
      }
      const prev = target.get(item.name);
      if (!prev || item.rank < prev.rank) {
        target.set(item.name, item);
      }
    }
  }
  function buildShopRankResults(followShopNames, rankMap) {
    const selfResults = [...rankMap.values()].filter((item) => item.isSelf).sort((a, b) => a.rank - b.rank);
    const selfNames = new Set(selfResults.map((item) => item.name));
    const followedResults = [];
    for (const name of followShopNames) {
      if (selfNames.has(name)) {
        continue;
      }
      const item = rankMap.get(name);
      if (item) {
        followedResults.push(item);
        continue;
      }
      followedResults.push({
        name,
        rank: Infinity,
        rankText: "200+",
        isSelf: false
      });
    }
    return [...selfResults, ...followedResults.sort((a, b) => a.rank - b.rank)];
  }
  async function collectShopRankItems(options) {
    const pageCount = options.pageCount ?? defaultPageCount;
    const rankMap = /* @__PURE__ */ new Map();
    for (let pageNo = 1; pageNo <= pageCount; pageNo += 1) {
      const url = options.buildPageUrl(pageNo);
      const json = await options.requestPage(url, pageNo);
      mergeShopRankItems(rankMap, parseShopRankRows(json), options.followShopNames);
    }
    return rankMap;
  }
  function formatMetricCell(cell) {
    if (!cell) return void 0;
    const valueText = getPath(cell, ["index_values", "value", "value_str"]);
    if (valueText) {
      return valueText;
    }
    const exactValue = toFiniteNumber(getPath(cell, ["index_values", "value", "value"]));
    const exactUnit = toFiniteNumber(getPath(cell, ["index_values", "value", "unit"]));
    if (exactValue !== void 0) {
      return formatRange(exactValue, exactValue, exactUnit);
    }
    const lowerText = getPath(cell, ["index_values", "extra_value", "lower", "value_str"]);
    const upperText = getPath(cell, ["index_values", "extra_value", "upper", "value_str"]);
    if (lowerText && upperText) {
      return lowerText === upperText ? lowerText : `${lowerText}-${upperText}`;
    }
    const lower = toFiniteNumber(getPath(cell, ["index_values", "extra_value", "lower", "value"]));
    const upper = toFiniteNumber(getPath(cell, ["index_values", "extra_value", "upper", "value"]));
    const unit = toFiniteNumber(getPath(cell, ["index_values", "extra_value", "lower", "unit"]));
    if (lower === void 0 || upper === void 0) {
      return void 0;
    }
    return formatRange(lower, upper, unit);
  }
  function formatRange(lower, upper, unit) {
    const lowerText = formatValue(lower, unit);
    const upperText = formatValue(upper, unit);
    return lowerText === upperText ? lowerText : `${lowerText}-${upperText}`;
  }
  function formatValue(value, unit) {
    switch (unit) {
      case 3:
        return formatMoney(value / 100);
      case 4:
        return `${formatNumber(value * 100)}%`;
      case 5:
        return formatLargeNumber(value);
      default:
        return formatNumber(value);
    }
  }
  function formatMoney(yuan) {
    if (yuan >= 1e8) return `¥${formatNumber(yuan / 1e8)}亿`;
    if (yuan >= 1e4) return `¥${formatNumber(yuan / 1e4)}万`;
    return `¥${formatNumber(yuan)}`;
  }
  function formatLargeNumber(value) {
    if (value >= 1e8) return `${formatNumber(value / 1e8)}亿`;
    if (value >= 1e4) return `${formatNumber(value / 1e4)}万`;
    return formatNumber(value);
  }
  function formatNumber(value) {
    return value.toFixed(2).replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
  }
  function toFiniteNumber(value) {
    const numberValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
    return Number.isFinite(numberValue) ? numberValue : void 0;
  }
  function getObject(source, key) {
    if (!source || typeof source !== "object") {
      return void 0;
    }
    const value = source[key];
    return value && typeof value === "object" ? value : void 0;
  }
  function getPath(source, path) {
    let current = source;
    for (const key of path) {
      if (!current || typeof current !== "object") {
        return void 0;
      }
      current = current[key];
    }
    return current;
  }
  function removeUndefinedItemFields(item) {
    const mutable = item;
    for (const key of Object.keys(mutable)) {
      if (mutable[key] === void 0) {
        delete mutable[key];
      }
    }
    return item;
  }
  async function fetchShopRankPage(url) {
    const response = await request({
      method: "GET",
      url,
      headers: {
        Accept: "application/json, text/plain, */*"
      },
      withCredentials: true,
      timeout: 15e3
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`店铺榜单请求失败: ${response.status} ${response.statusText}`);
    }
    try {
      return JSON.parse(response.text);
    } catch {
      throw new Error("店铺榜单接口返回不是合法 JSON");
    }
  }
  const columns = [
    { key: "name", label: "店铺名称" },
    { key: "rankText", label: "当前排名" },
    { key: "payAmt", label: "成交金额" },
    { key: "payCnt", label: "成交订单数" },
    { key: "productShowUcnt", label: "曝光人数" },
    { key: "productClickUcnt", label: "点击人数" },
    { key: "payUcnt", label: "成交人数" },
    { key: "payUserUnitPrice", label: "客单价" },
    { key: "productShowClickRatio", label: "点击率" },
    { key: "productClickPayRatio", label: "转化率" }
  ];
  function openShopRankResultModal(options) {
    const content = document.createElement("div");
    content.className = "ddt-shop-rank-result";
    const subtitle = document.createElement("p");
    subtitle.className = "ddt-shop-rank-subtitle";
    subtitle.textContent = "目标店铺实时排名，按名次从高到低排序。";
    content.append(subtitle, createResultTable(options.results));
    const syncButton = createButton({
      text: "更新在线表格",
      variant: "primary",
      loadingText: "更新中...",
      onClick: () => options.onSync(options.results)
    });
    return openModal({
      title: "关注店铺榜单概览",
      content,
      width: 1120,
      footer: syncButton,
      closeOnOverlay: false
    });
  }
  function createResultTable(results) {
    const wrapper = document.createElement("div");
    wrapper.className = "ddt-shop-rank-table-wrap";
    const table = document.createElement("table");
    table.className = "ddt-shop-rank-table";
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    for (const column of columns) {
      const th = document.createElement("th");
      th.textContent = column.label;
      headRow.append(th);
    }
    thead.append(headRow);
    const tbody = document.createElement("tbody");
    if (results.length === 0) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = columns.length;
      cell.className = "ddt-shop-rank-empty";
      cell.textContent = "未检索到目标店铺数据";
      row.append(cell);
      tbody.append(row);
    } else {
      for (const result of results) {
        tbody.append(createResultRow(result));
      }
    }
    table.append(thead, tbody);
    wrapper.append(table);
    return wrapper;
  }
  function createResultRow(result) {
    const row = document.createElement("tr");
    if (result.isSelf) {
      row.classList.add("ddt-shop-rank-self-row");
    }
    for (const column of columns) {
      const cell = document.createElement("td");
      const value = result[column.key];
      cell.textContent = value === void 0 || value === null || value === "" ? "-" : String(value);
      if (column.key === "name" && result.isSelf) {
        const badge = document.createElement("span");
        badge.className = "ddt-shop-rank-self-badge";
        badge.textContent = "本店";
        cell.append(" ", badge);
      }
      if (column.key === "rankText") {
        cell.className = result.isSelf ? "ddt-shop-rank-self-rank" : result.rank === Infinity ? "ddt-shop-rank-missing" : "ddt-shop-rank-rank";
      }
      row.append(cell);
    }
    return row;
  }
  const paginationTriggerSelectors = [
    "li.ecom-pagination-next",
    "li.ecom-pagination-prev",
    "li.ecom-pagination-item:not(.ecom-pagination-item-active)"
  ];
  function clickPaginationForShopRankCapture(root = document) {
    for (const selector of paginationTriggerSelectors) {
      const element = [...root.querySelectorAll(selector)].find((item) => isClickablePaginationItem(item));
      if (!element) {
        continue;
      }
      element.click();
      return true;
    }
    return false;
  }
  function isClickablePaginationItem(element) {
    if (element.classList.contains("ecom-pagination-disabled")) {
      return false;
    }
    if (element.getAttribute("aria-disabled") === "true") {
      return false;
    }
    if ("disabled" in element && Boolean(element.disabled)) {
      return false;
    }
    return true;
  }
  const shopRankPath = "/compass_api/shop/mall/market/shop_rank";
  const dynamicQueryParams = ["_lid", "msToken", "a_bogus", "verifyFp", "fp"];
  const cacheIgnoredQueryParams = ["page_no", "page_size", ...dynamicQueryParams];
  class ShopRankRequestTemplate {
    constructor(origin) {
      this.origin = origin;
    }
    capture(url) {
      const parsed = this.parseUrl(url);
      if (!parsed.pathname.endsWith(shopRankPath)) {
        return false;
      }
      this.templateUrl = parsed;
      return true;
    }
    hasTemplate() {
      return this.templateUrl !== void 0;
    }
    buildPageUrl(pageNo) {
      if (!this.templateUrl) {
        throw new Error("尚未捕获店铺榜单请求");
      }
      const pageUrl = new URL(this.templateUrl.toString());
      pageUrl.searchParams.set("page_no", String(pageNo));
      if (!pageUrl.searchParams.has("page_size")) {
        pageUrl.searchParams.set("page_size", "20");
      }
      {
        for (const name of dynamicQueryParams) {
          pageUrl.searchParams.delete(name);
        }
      }
      return pageUrl.toString();
    }
    getCacheKey() {
      if (!this.templateUrl) {
        throw new Error("尚未捕获店铺榜单请求");
      }
      const entries = [...this.templateUrl.searchParams.entries()].filter(([name]) => !cacheIgnoredQueryParams.includes(name)).sort(([leftName, leftValue], [rightName, rightValue]) => {
        if (leftName === rightName) {
          return leftValue.localeCompare(rightValue);
        }
        return leftName.localeCompare(rightName);
      });
      const query = new URLSearchParams(entries);
      const queryString = query.toString();
      return `${this.templateUrl.origin}${this.templateUrl.pathname}${queryString ? `?${queryString}` : ""}`;
    }
    parseUrl(url) {
      return new URL(url, this.origin);
    }
  }
  function columnIndexToLetter(index) {
    if (!Number.isInteger(index) || index < 0) {
      throw new Error(`非法列索引: ${index}`);
    }
    let current = index;
    let letter = "";
    while (current >= 0) {
      letter = String.fromCharCode(65 + current % 26) + letter;
      current = Math.floor(current / 26) - 1;
    }
    return letter;
  }
  function buildShopRankSyncPayload(options) {
    const targetColumnIndex = options.headerRow.findIndex((cell) => String(cell).trim() === options.currentDate);
    if (targetColumnIndex < 1) {
      throw new Error(`未找到日期为 ${options.currentDate} 的列，请先在表头添加该日期列`);
    }
    const rankMap = new Map(options.results.map((item) => [item.name, item.rank === Infinity ? "200+" : item.rank]));
    const values = [];
    for (const row of options.shopNameRows) {
      const shopName = row[0] === void 0 || row[0] === null ? "" : String(row[0]).trim();
      if (!shopName) {
        break;
      }
      values.push([rankMap.get(shopName) ?? "200+"]);
    }
    const column = columnIndexToLetter(targetColumnIndex);
    return {
      range: `${options.sheetId}!${column}2:${column}${values.length + 1}`,
      values
    };
  }
  async function syncShopRankToFeishu(options) {
    const currentDate = options.currentDate ?? getCurrentDate();
    const headerRows = await options.sheet.readRange(options.spreadsheetToken, `${options.sheetId}!A1:ZZ1`, {
      dateTimeRenderOption: "FormattedString"
    });
    if (headerRows.length === 0) {
      throw new Error("读取飞书表头失败");
    }
    const shopNameRows = await options.sheet.readRange(options.spreadsheetToken, `${options.sheetId}!A2:A100`);
    if (shopNameRows.length === 0) {
      throw new Error("读取飞书店铺名称列失败");
    }
    const payload = buildShopRankSyncPayload({
      sheetId: options.sheetId,
      currentDate,
      headerRow: headerRows[0] ?? [],
      shopNameRows,
      results: options.results
    });
    await options.sheet.writeRange(options.spreadsheetToken, payload.range, payload.values);
  }
  function getCurrentDate() {
    const now = /* @__PURE__ */ new Date();
    return `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`;
  }
  const shopRankCacheTtlMs = 3 * 60 * 1e3;
  class ShopRankFeature {
    constructor(context) {
      this.context = context;
      this.requestTemplate = new ShopRankRequestTemplate(location.origin);
      this.templateCaptureWaiters = /* @__PURE__ */ new Set();
      this.rankCache = /* @__PURE__ */ new Map();
      this.collecting = false;
    }
    init() {
      this.registerRequestTemplateListener();
      void this.mountButton();
      this.context.logger.info("初始化功能：shop-rank");
    }
    destroy() {
      var _a;
      this.resolveTemplateCaptureWaiters(false);
      (_a = this.button) == null ? void 0 : _a.remove();
      this.button = void 0;
      this.context.logger.info("销毁功能：shop-rank");
    }
    registerRequestTemplateListener() {
      const id = this.context.requestListener.add({
        id: `${this.context.featureId}.request-template`,
        match: /\/compass_api\/shop\/mall\/market\/shop_rank(?:[/?#]|$)/,
        methods: ["GET"],
        onRequest: (payload) => {
          if (this.requestTemplate.capture(payload.url)) {
            this.context.logger.debug("已捕获店铺榜单请求模板", payload.url);
            this.resolveTemplateCaptureWaiters(true);
          }
        }
      });
      this.context.disposables.add(() => this.context.requestListener.remove(id));
    }
    async mountButton() {
      var _a;
      await waitForElement(".ecom-spin-container", { timeoutMs: 5e3 }).catch(() => void 0);
      if ((_a = this.button) == null ? void 0 : _a.isConnected) {
        return;
      }
      const button = createButton({
        text: "采集关注店铺",
        variant: "primary",
        loadingText: "采集中...",
        onClick: () => this.collect()
      });
      button.classList.add("ddt-shop-rank-button");
      getMountHost().append(button);
      this.button = button;
      this.context.disposables.add(() => button.remove());
    }
    async collect() {
      if (this.collecting) {
        Toast.warning("正在采集中，请勿重复点击");
        return;
      }
      const followShopNames = parseFollowShopNames(this.context.config.get("followShopNames"));
      if (followShopNames.size === 0) {
        Toast.error("请先在设置中配置关注店铺名称");
        return;
      }
      this.collecting = true;
      try {
        if (!this.requestTemplate.hasTemplate()) {
          Toast.info("尚未捕获店铺榜单请求，正在自动翻页捕获...");
          const captured = await this.captureTemplateByPagination();
          if (!captured) {
            Toast.warning("自动翻页后仍未捕获店铺榜单请求，请切换筛选条件后重试");
            return;
          }
        }
        const cacheKey = this.requestTemplate.getCacheKey();
        const cachedRankMap = this.getCachedRankMap(cacheKey);
        if (cachedRankMap) {
          Toast.info("使用 3 分钟内缓存的店铺榜单数据");
          this.openResults(buildShopRankResults(followShopNames, cachedRankMap));
          return;
        }
        Toast.info("开始采集店铺榜单数据...");
        const rankMap = await collectShopRankItems({
          followShopNames,
          buildPageUrl: (pageNo) => this.requestTemplate.buildPageUrl(pageNo),
          requestPage: (url) => fetchShopRankPage(url)
        });
        this.rankCache.set(cacheKey, {
          createdAt: Date.now(),
          rankMap: new Map(rankMap)
        });
        const results = buildShopRankResults(followShopNames, rankMap);
        Toast.success("店铺榜单采集完成");
        this.openResults(results);
      } catch (error) {
        this.context.logger.error("店铺榜单采集失败", error);
        Toast.error(formatError$2(error, "店铺榜单采集失败"));
      } finally {
        this.collecting = false;
      }
    }
    getCachedRankMap(cacheKey) {
      const entry = this.rankCache.get(cacheKey);
      if (!entry) {
        return void 0;
      }
      if (Date.now() - entry.createdAt > shopRankCacheTtlMs) {
        this.rankCache.delete(cacheKey);
        return void 0;
      }
      return new Map(entry.rankMap);
    }
    openResults(results) {
      openShopRankResultModal({
        results,
        onSync: (modalResults) => this.handleSyncResults(modalResults)
      });
    }
    async syncResults(results) {
      const feishuDocId = String(this.context.config.get("feishuDocId") ?? "").trim();
      const feishuSheetId = String(this.context.config.get("feishuSheetId") ?? "").trim();
      if (!feishuDocId || !feishuSheetId) {
        throw new Error("请先配置飞书文档 ID 和工作表 ID");
      }
      const client = new FeishuClient({
        appId: this.context.appConfig.getGlobal("feishuAppId") ?? "",
        appSecret: this.context.appConfig.getGlobal("feishuAppSecret") ?? ""
      });
      const sheet = new FeishuSheet(client);
      await syncShopRankToFeishu({
        sheet,
        spreadsheetToken: feishuDocId,
        sheetId: feishuSheetId,
        results
      });
      Toast.success("在线表格已更新");
    }
    async handleSyncResults(results) {
      try {
        await this.syncResults(results);
      } catch (error) {
        this.context.logger.error("店铺榜单同步飞书失败", error);
        Toast.error(formatError$2(error, "店铺榜单同步飞书失败"));
        throw error;
      }
    }
    async captureTemplateByPagination() {
      if (this.requestTemplate.hasTemplate()) {
        return true;
      }
      const captureWait = this.createTemplateCaptureWait(8e3);
      const clicked = clickPaginationForShopRankCapture();
      if (!clicked) {
        captureWait.cancel();
        return false;
      }
      return await captureWait.promise;
    }
    createTemplateCaptureWait(timeoutMs) {
      if (this.requestTemplate.hasTemplate()) {
        return {
          promise: Promise.resolve(true),
          cancel() {
          }
        };
      }
      let settled = false;
      let timer = 0;
      let complete;
      const promise = new Promise((resolve) => {
        complete = (captured) => {
          if (settled) {
            return;
          }
          settled = true;
          window.clearTimeout(timer);
          this.templateCaptureWaiters.delete(complete);
          resolve(captured);
        };
        this.templateCaptureWaiters.add(complete);
        timer = window.setTimeout(() => complete(false), timeoutMs);
      });
      return {
        promise,
        cancel: () => complete(false)
      };
    }
    resolveTemplateCaptureWaiters(captured) {
      for (const complete of [...this.templateCaptureWaiters]) {
        complete(captured);
      }
    }
  }
  function getMountHost() {
    return document.body ?? document.documentElement;
  }
  function formatError$2(error, fallback) {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    if (typeof error === "string" && error.trim()) {
      return error;
    }
    return fallback;
  }
  const shopRankFeature = {
    id: "shop-rank",
    name: "罗盘竞店榜单",
    description: "采集关注店铺排名，并同步到在线表格",
    matches: [/compass\.jinritemai\.com\/shop\/chance\/rank-shop/],
    defaultEnabled: true,
    settings: [
      { type: "textarea", key: "followShopNames", label: "关注店铺名称", defaultValue: "" },
      { type: "text", key: "feishuDocId", label: "飞书文档 ID", defaultValue: "" },
      { type: "text", key: "feishuSheetId", label: "飞书工作表 ID", defaultValue: "" }
    ],
    create: (context) => new ShopRankFeature(context)
  };
  const fixedGfVersion = "1.0.1.8004";
  async function fetchAccountContext(aavid, requester = request) {
    var _a, _b, _c, _d, _e, _f;
    const payload = await requestJson({
      method: "GET",
      path: `/ad/api/v1/account/user/info?aavid=${encodeURIComponent(aavid)}`,
      requester
    });
    const advId = String(((_b = (_a = payload.data) == null ? void 0 : _a.accountInfo) == null ? void 0 : _b.advId) ?? "").trim();
    const advName = String(((_d = (_c = payload.data) == null ? void 0 : _c.accountInfo) == null ? void 0 : _d.advName) ?? "").trim();
    const shopId = String(((_f = (_e = payload.data) == null ? void 0 : _e.shopInfo) == null ? void 0 : _f.shopId) ?? "").trim();
    if (!advId || !advName || !shopId) {
      throw new Error("账号信息接口返回缺少必要字段");
    }
    return { advId, advName, shopId };
  }
  async function fetchDouyinAccount(uniqueId, advId, requester = request) {
    var _a, _b;
    const payload = await requestJson({
      method: "POST",
      path: buildApiPath("/ad/api/v1/account/get-douyin-account", advId),
      data: {
        uniqueId,
        aavid: advId
      },
      requester
    });
    const awemeUserId = String(((_a = payload.data) == null ? void 0 : _a.userId) ?? "").trim();
    const nickname = String(((_b = payload.data) == null ? void 0 : _b.nickname) ?? "").trim();
    if (!awemeUserId) {
      throw new Error("抖音号校验结果缺少达人 UID");
    }
    return { awemeUserId, nickname };
  }
  async function preCheckInviteUser(payload, requester = request) {
    await requestJson({
      method: "POST",
      path: buildApiPath("/ad/api/v1/account/pre-check-invite-user", payload.advId),
      data: buildPreCheckPayload(payload),
      requester
    });
  }
  async function preNoticeInviteUser(awemeUserId, advId, requester = request) {
    await requestJson({
      method: "GET",
      path: buildApiPath(
        `/ad/api/v1/account/agw/aweme/pre-notice-invite-user?awemeUserId=${encodeURIComponent(awemeUserId)}&authTargetType=4`,
        advId
      ),
      requester
    });
  }
  async function applyAuthorization(payload, requester = request) {
    await requestJson({
      method: "POST",
      path: buildApiPath("/ad/api/v1/account/apply-authorization", payload.advId),
      data: buildApplyPayload(payload),
      requester
    });
  }
  async function batchApplyUniPromAuth(payload, requester = request) {
    const response = await requestJson({
      method: "POST",
      path: buildApiPath("/ad/api/v1/account/uni_prom/batch-apply-uni-prom-auth", payload.advId),
      data: {
        awemeUIds: payload.awemeUserIds.join(","),
        shopId: payload.shopId,
        marGoal: 1,
        aavid: payload.advId
      },
      requester
    });
    return payload.awemeUserIds.map((awemeUserId) => {
      var _a, _b, _c;
      const item = (_b = (_a = response.data) == null ? void 0 : _a.applyResult) == null ? void 0 : _b.find((result) => {
        var _a2;
        return String(((_a2 = result.authorisedAwemeInfo) == null ? void 0 : _a2.id) ?? "") === awemeUserId;
      });
      return {
        awemeUserId,
        success: Boolean(item == null ? void 0 : item.flag),
        reason: (item == null ? void 0 : item.flag) ? "" : String(((_c = item == null ? void 0 : item.error) == null ? void 0 : _c.errorMessage) ?? "")
      };
    });
  }
  async function requestJson(options) {
    const response = await options.requester({
      method: options.method,
      url: `${location.origin}${options.path}`,
      headers: buildHeaders(options.method),
      data: options.data,
      timeout: 15e3,
      withCredentials: true
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`请求失败: ${response.status} ${response.statusText}`);
    }
    const payload = parseResponseText(response.text);
    if (Number(payload.status_code) !== 0) {
      throw new Error(String(payload.message ?? "请求失败"));
    }
    return payload;
  }
  function buildHeaders(method) {
    const headers = {
      Accept: "application/json, text/plain, */*",
      Referer: location.href,
      "x-csrftoken": readCookie("csrftoken")
    };
    if (method === "POST") {
      headers["Content-Type"] = "application/json";
    }
    return headers;
  }
  function buildApiPath(basePath, advId) {
    const joiner = basePath.includes("?") ? "&" : "?";
    return `${basePath}${joiner}aavid=${encodeURIComponent(advId)}&gfversion=${encodeURIComponent(fixedGfVersion)}`;
  }
  function buildPreCheckPayload(payload) {
    return {
      code: payload.inviteCode,
      awemeUserId: payload.awemeUserId,
      aavid: payload.advId
    };
  }
  function buildApplyPayload(payload) {
    return {
      authTargetType: 4,
      authTargetId: payload.awemeUserId,
      scene: 5,
      code: payload.inviteCode,
      endTime: payload.endTime,
      note: "",
      aavid: payload.advId
    };
  }
  function parseResponseText(text) {
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("接口返回不是合法 JSON");
    }
  }
  function readCookie(name) {
    const matched = document.cookie.match(new RegExp(`(?:^|; )${escapeRegExp(name)}=([^;]*)`));
    return matched ? decodeURIComponent(matched[1]) : "";
  }
  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  const standardLinePattern = /^(\S+)\s+(\S+)$/;
  function extractBatchAuthStandardText(text) {
    const normalized = text.replace(/\r/g, "");
    const blocks = normalized.split(/\n\s*\n+/).map((item) => item.trim()).filter(Boolean);
    const lines = [];
    let skippedCount = 0;
    for (const block of blocks) {
      const uniqueId = matchFieldValue(block, /抖音号\s*[:：]\s*(.+)/);
      const inviteCode = matchFieldValue(block, /合作码\s*[:：]\s*(.+)/);
      if (!uniqueId || !inviteCode) {
        skippedCount += 1;
        continue;
      }
      lines.push(`${uniqueId} ${inviteCode}`);
    }
    return {
      standardText: lines.join("\n"),
      extractedCount: lines.length,
      skippedCount
    };
  }
  function parseBatchAuthInputText(text) {
    const rawLines = text.replace(/\r/g, "").split("\n");
    const validRows = [];
    const failures = [];
    const seenUniqueIds = /* @__PURE__ */ new Set();
    rawLines.forEach((rawLine, index) => {
      const trimmedLine = rawLine.trim();
      if (!trimmedLine) {
        return;
      }
      const matched = trimmedLine.match(standardLinePattern);
      const lineNo = index + 1;
      if (!matched) {
        failures.push(buildFailure({
          lineNo,
          rawLine: trimmedLine,
          uniqueId: "",
          reason: "格式错误：每行必须为“抖音号 合作码”"
        }));
        return;
      }
      const [, uniqueId, inviteCode] = matched;
      if (seenUniqueIds.has(uniqueId)) {
        failures.push(buildFailure({
          lineNo,
          rawLine: trimmedLine,
          uniqueId,
          reason: "抖音号重复"
        }));
        return;
      }
      seenUniqueIds.add(uniqueId);
      validRows.push({
        lineNo,
        rawLine: trimmedLine,
        uniqueId,
        inviteCode
      });
    });
    return { validRows, failures };
  }
  function parseBatchAuthDeadline(value) {
    const trimmed = value.trim();
    const matched = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!matched) {
      throw new Error("授权截止时间格式错误，请输入 YYYY-MM-DD");
    }
    const year = Number(matched[1]);
    const month = Number(matched[2]);
    const day = Number(matched[3]);
    const timestamp = Math.floor(Date.UTC(year, month - 1, day, 15, 59, 59) / 1e3);
    const validator = new Date(timestamp * 1e3);
    if (validator.getUTCFullYear() !== year || validator.getUTCMonth() !== month - 1 || validator.getUTCDate() !== day) {
      throw new Error("授权截止时间格式错误，请输入 YYYY-MM-DD");
    }
    return timestamp;
  }
  function matchFieldValue(block, pattern) {
    var _a;
    const matched = block.match(pattern);
    if (!matched) {
      return "";
    }
    return ((_a = matched[1].split("\n")[0]) == null ? void 0 : _a.trim()) ?? "";
  }
  function buildFailure(input) {
    return input;
  }
  function openBatchAuthApplyModal(options) {
    const api = {
      fetchDouyinAccount,
      preCheckInviteUser,
      preNoticeInviteUser,
      applyAuthorization,
      batchApplyUniPromAuth,
      ...options.api
    };
    const toast = options.toast ?? Toast;
    const clipboard = options.clipboard ?? navigator.clipboard;
    const state = {
      validatedRows: [],
      failures: [],
      finalResults: [],
      hasValidated: false
    };
    const content = document.createElement("div");
    content.className = "ddt-batch-auth-apply-modal";
    const accountText = document.createElement("div");
    accountText.className = "ddt-batch-auth-apply-account";
    accountText.textContent = `当前账号：${options.accountContext.advName}`;
    const deadlineInput = createTextInput({
      value: "2030-12-31",
      placeholder: "YYYY-MM-DD",
      className: "ddt-batch-auth-apply-deadline"
    });
    const deadlineRow = document.createElement("div");
    deadlineRow.className = "ddt-batch-auth-apply-toolbar";
    const deadlineLabel = document.createElement("span");
    deadlineLabel.textContent = "授权截止时间";
    deadlineRow.append(deadlineLabel, deadlineInput);
    const textarea = createTextarea({
      rows: 12,
      placeholder: "每行输入：抖音号 合作码",
      className: "ddt-batch-auth-apply-textarea"
    });
    const topActions = document.createElement("div");
    topActions.className = "ddt-batch-auth-apply-toolbar";
    const extractButton = createButton({
      text: "提取",
      variant: "secondary",
      size: "small",
      onClick: () => {
        const result = extractBatchAuthStandardText(textarea.value);
        textarea.value = result.standardText;
        resetValidationState(state, successList, failureList, resultPanel, submitButton);
        if (result.skippedCount > 0) {
          toast.warning(`已提取 ${result.extractedCount} 条标准数据，忽略 ${result.skippedCount} 条不完整数据`);
        }
      }
    });
    extractButton.classList.add("ddt-batch-auth-apply-extract");
    topActions.append(extractButton);
    const validateButton = createButton({
      text: "校验",
      variant: "primary",
      size: "small",
      loadingText: "校验中...",
      onClick: async () => {
        const validationResult = await validateRows();
        renderValidationList(successList, validationResult.validatedRows.map((row) => `${row.uniqueId} | ${row.nickname} | ${row.awemeUserId} | ${row.inviteCode}`));
        renderFailureList(failureList, validationResult.failures, clipboard);
      }
    });
    validateButton.classList.add("ddt-batch-auth-apply-validate");
    const editorPanel = document.createElement("div");
    editorPanel.className = "ddt-batch-auth-apply-panel";
    const validationSection = document.createElement("div");
    validationSection.className = "ddt-batch-auth-apply-panel";
    const successTitle = document.createElement("h4");
    successTitle.textContent = "校验通过";
    const successList = document.createElement("div");
    successList.className = "ddt-batch-auth-apply-list ddt-batch-auth-apply-success-list";
    const failureTitle = document.createElement("h4");
    failureTitle.textContent = "校验失败";
    const failureList = document.createElement("div");
    failureList.className = "ddt-batch-auth-apply-list ddt-batch-auth-apply-failure-list";
    validationSection.append(successTitle, successList, failureTitle, failureList);
    editorPanel.append(accountText, deadlineRow, topActions, textarea, validateButton, validationSection);
    const resultPanel = document.createElement("div");
    resultPanel.className = "ddt-batch-auth-apply-result-panel ddt-batch-auth-apply-panel";
    resultPanel.style.display = "none";
    const footer = document.createElement("div");
    footer.style.display = "flex";
    footer.style.justifyContent = "flex-end";
    footer.style.gap = "8px";
    let modalInstance;
    const closeButton = createButton({
      text: "关闭",
      variant: "secondary",
      size: "small",
      onClick: () => {
        modalInstance.close();
      }
    });
    const submitButton = createButton({
      text: "发送",
      variant: "primary",
      size: "small",
      loadingText: "发送中...",
      onClick: async () => {
        if (!state.hasValidated) {
          toast.warning("请先完成校验后再发送授权申请");
          return;
        }
        const finalResults = await submitValidatedRows();
        renderFinalResults(resultPanel, finalResults);
        editorPanel.style.display = "none";
        resultPanel.style.display = "block";
        submitButton.style.display = "none";
      }
    });
    submitButton.classList.add("ddt-batch-auth-apply-submit");
    footer.append(closeButton, submitButton);
    content.append(editorPanel, resultPanel);
    textarea.addEventListener("input", () => {
      resetValidationState(state, successList, failureList, resultPanel, submitButton);
    });
    deadlineInput.addEventListener("input", () => {
      resetValidationState(state, successList, failureList, resultPanel, submitButton);
    });
    modalInstance = openModal({
      title: "批量发送授权申请",
      width: 860,
      content,
      footer
    });
    return modalInstance;
    async function validateRows() {
      const endTime = parseBatchAuthDeadline(deadlineInput.value);
      const parsed = parseBatchAuthInputText(textarea.value);
      const validatedRows = [];
      const failures = [...parsed.failures];
      for (const row of parsed.validRows) {
        try {
          const aweme = await api.fetchDouyinAccount(row.uniqueId, options.accountContext.advId);
          await api.preCheckInviteUser({
            advId: options.accountContext.advId,
            awemeUserId: aweme.awemeUserId,
            inviteCode: row.inviteCode
          });
          validatedRows.push({
            ...row,
            awemeUserId: aweme.awemeUserId,
            nickname: aweme.nickname
          });
        } catch (error) {
          failures.push({
            lineNo: row.lineNo,
            rawLine: row.rawLine,
            uniqueId: row.uniqueId,
            reason: formatError$1(error)
          });
        }
      }
      state.validatedRows = validatedRows;
      state.failures = failures;
      state.validatedEndTime = endTime;
      state.hasValidated = true;
      state.finalResults = [];
      return { validatedRows, failures };
    }
    async function submitValidatedRows() {
      const endTime = state.validatedEndTime;
      if (!endTime) {
        throw new Error("缺少授权截止时间，请重新校验后再发送");
      }
      const standardSuccessRows = [];
      const finalResults = [];
      for (const row of state.validatedRows) {
        try {
          await api.preNoticeInviteUser(row.awemeUserId, options.accountContext.advId);
          await api.applyAuthorization({
            advId: options.accountContext.advId,
            awemeUserId: row.awemeUserId,
            inviteCode: row.inviteCode,
            endTime
          });
          standardSuccessRows.push(row);
        } catch (error) {
          finalResults.push({
            uniqueId: row.uniqueId,
            awemeUserId: row.awemeUserId,
            nickname: row.nickname,
            success: false,
            stage: "standard",
            reason: `标准授权失败：${formatError$1(error)}`
          });
        }
      }
      if (standardSuccessRows.length > 0) {
        const uniPromResults = await api.batchApplyUniPromAuth({
          advId: options.accountContext.advId,
          shopId: options.accountContext.shopId,
          awemeUserIds: standardSuccessRows.map((row) => row.awemeUserId)
        });
        for (const row of standardSuccessRows) {
          const uniPromResult = uniPromResults.find((item) => item.awemeUserId === row.awemeUserId);
          if (uniPromResult == null ? void 0 : uniPromResult.success) {
            finalResults.push({
              uniqueId: row.uniqueId,
              awemeUserId: row.awemeUserId,
              nickname: row.nickname,
              success: true,
              stage: "",
              reason: ""
            });
            continue;
          }
          finalResults.push({
            uniqueId: row.uniqueId,
            awemeUserId: row.awemeUserId,
            nickname: row.nickname,
            success: false,
            stage: "uni-prom",
            reason: `全域授权失败：${(uniPromResult == null ? void 0 : uniPromResult.reason) || "未知错误"}`
          });
        }
      }
      state.finalResults = finalResults;
      return finalResults;
    }
  }
  function renderValidationList(container, lines) {
    container.innerHTML = "";
    if (lines.length === 0) {
      container.textContent = "暂无数据";
      return;
    }
    for (const line of lines) {
      const item = document.createElement("div");
      item.className = "ddt-batch-auth-apply-list-item";
      item.textContent = line;
      container.append(item);
    }
  }
  function renderFailureList(container, failures, clipboard) {
    container.innerHTML = "";
    if (failures.length === 0) {
      container.textContent = "暂无数据";
      return;
    }
    for (const failure of failures) {
      const item = document.createElement("div");
      item.className = "ddt-batch-auth-apply-list-item ddt-batch-auth-apply-list-item-failed";
      item.textContent = `${failure.uniqueId || failure.rawLine} | ${failure.reason}`;
      item.addEventListener("click", () => {
        void clipboard.writeText(failure.uniqueId || failure.rawLine);
      });
      container.append(item);
    }
  }
  function renderFinalResults(container, finalResults) {
    container.innerHTML = "";
    const successTitle = document.createElement("h4");
    successTitle.textContent = "发送成功";
    const successList = document.createElement("div");
    successList.className = "ddt-batch-auth-apply-list";
    const failureTitle = document.createElement("h4");
    failureTitle.textContent = "发送失败";
    const failureList = document.createElement("div");
    failureList.className = "ddt-batch-auth-apply-list";
    renderValidationList(
      successList,
      finalResults.filter((item) => item.success).map((item) => `${item.uniqueId} | ${item.nickname} | ${item.awemeUserId}`)
    );
    renderValidationList(
      failureList,
      finalResults.filter((item) => !item.success).map((item) => `${item.uniqueId} | ${item.nickname} | ${item.reason}`)
    );
    container.append(successTitle, successList, failureTitle, failureList);
  }
  function resetValidationState(state, successList, failureList, resultPanel, submitButton) {
    state.validatedRows = [];
    state.failures = [];
    state.finalResults = [];
    state.validatedEndTime = void 0;
    state.hasValidated = false;
    successList.innerHTML = "";
    failureList.innerHTML = "";
    resultPanel.innerHTML = "";
    resultPanel.style.display = "none";
    submitButton.style.display = "";
  }
  function formatError$1(error) {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    if (typeof error === "string" && error.trim()) {
      return error;
    }
    return "未知错误";
  }
  class BatchAuthApplyFeature {
    constructor(context, deps = {}) {
      this.context = context;
      this.fetchAccountContext = deps.fetchAccountContext ?? fetchAccountContext;
      this.openModal = deps.openModal ?? openBatchAuthApplyModal;
      this.toast = deps.toast ?? Toast;
    }
    init() {
      ensureUiTheme();
      this.registerAccountContextListener();
      this.mountButton();
      this.context.logger.info("初始化功能：batch-auth-apply");
    }
    destroy() {
      var _a, _b;
      (_a = this.currentModal) == null ? void 0 : _a.close();
      this.currentModal = void 0;
      (_b = this.button) == null ? void 0 : _b.remove();
      this.button = void 0;
      this.context.logger.info("销毁功能：batch-auth-apply");
    }
    /**
     * 监听账号信息接口，并在请求回放或实时响应中缓存最新账号上下文。
     */
    registerAccountContextListener() {
      const listenerId = this.context.requestListener.add({
        id: `${this.context.featureId}.account-context`,
        match: /\/ad\/api\/v1\/account\/user\/info(?:[/?#]|$)/,
        methods: ["GET"],
        onResponse: (payload) => {
          const parsed = parseAccountContextFromPayload(payload.json);
          if (parsed) {
            this.accountContext = parsed;
          }
        }
      });
      this.context.disposables.add(() => this.context.requestListener.remove(listenerId));
    }
    /**
     * 在页面右下角挂载悬浮按钮。
     * 按钮固定挂载到 `body`，不依赖页面内部工具栏结构。
     */
    mountButton() {
      var _a;
      if ((_a = this.button) == null ? void 0 : _a.isConnected) {
        return;
      }
      const button = createButton({
        text: "批量申请授权",
        variant: "primary",
        onClick: async () => {
          await this.handleOpenModal();
        }
      });
      button.classList.add("ddt-batch-auth-apply-button");
      (document.body ?? document.documentElement).append(button);
      this.button = button;
      this.context.disposables.add(() => button.remove());
    }
    /**
     * 打开批量授权申请弹窗。
     * 若监听中尚未拿到账号信息，则回退从 URL 读取 `aavid` 并主动补拉。
     */
    async handleOpenModal() {
      var _a;
      try {
        const accountContext = await this.resolveAccountContext();
        (_a = this.currentModal) == null ? void 0 : _a.close();
        this.currentModal = this.openModal({ accountContext });
      } catch (error) {
        this.context.logger.error("打开批量授权申请弹窗失败", error);
        this.toast.error(formatError(error, "打开批量授权申请弹窗失败"));
      }
    }
    /**
     * 优先使用监听到的账号上下文。
     * 未命中时，从页面 URL 中读取 `aavid` 主动补拉一次。
     */
    async resolveAccountContext() {
      var _a;
      if (this.accountContext) {
        return this.accountContext;
      }
      const aavid = ((_a = new URL(location.href).searchParams.get("aavid")) == null ? void 0 : _a.trim()) ?? "";
      if (!aavid) {
        throw new Error("当前页面缺少 aavid 参数，无法获取账号信息");
      }
      const accountContext = await this.fetchAccountContext(aavid);
      this.accountContext = accountContext;
      return accountContext;
    }
  }
  function parseAccountContextFromPayload(payload) {
    var _a, _b, _c;
    const data = (_a = asRecord(payload)) == null ? void 0 : _a.data;
    const accountInfo = asRecord((_b = asRecord(data)) == null ? void 0 : _b.accountInfo);
    const shopInfo = asRecord((_c = asRecord(data)) == null ? void 0 : _c.shopInfo);
    const advId = String((accountInfo == null ? void 0 : accountInfo.advId) ?? "").trim();
    const advName = String((accountInfo == null ? void 0 : accountInfo.advName) ?? "").trim();
    const shopId = String((shopInfo == null ? void 0 : shopInfo.shopId) ?? "").trim();
    if (!advId || !advName || !shopId) {
      return void 0;
    }
    return { advId, advName, shopId };
  }
  function asRecord(value) {
    return typeof value === "object" && value !== null ? value : void 0;
  }
  function formatError(error, fallback) {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    if (typeof error === "string" && error.trim()) {
      return error;
    }
    return fallback;
  }
  const batchAuthApplyFeature = {
    id: "batch-auth-apply",
    name: "批量发送授权申请",
    description: "在千川授权页批量校验抖音号与合作码，并分阶段发送授权申请",
    matches: [/qianchuan\.jinritemai\.com\/account-center\/aweme-auth/],
    defaultEnabled: true,
    create: (context) => new BatchAuthApplyFeature(context)
  };
  const videoCardSelector = ".ecom-dorami-video-container";
  const actionHostSelector = ".ecom-dorami-atom-text-extra";
  const titleSelector = ".ecom-dorami-atom-text";
  const downloadButtonClassName = "ddt-content-rank-download-button";
  const mountedMarkerName = "ddtContentRankDownloadMounted";
  const defaultFileName = "内容榜单视频.mp4";
  const downloadButtonTitle = "下载视频";
  class ContentRankEnhanceFeature {
    constructor(context) {
      this.context = context;
      this.active = false;
      this.objectUrls = /* @__PURE__ */ new Set();
    }
    /**
     * 初始化模块。
     * 启动样式注入、首轮扫描和后续 DOM 观察，确保动态出现的视频卡片也能补挂按钮。
     */
    init() {
      this.active = true;
      ensureContentRankButtonStyle();
      this.scanWithin(document);
      this.startObserver();
      this.context.logger.info("初始化功能：content-rank-enhance");
    }
    /**
     * 销毁模块。
     * 停止 DOM 观察，移除已注入按钮，并释放尚未回收的对象 URL。
     */
    destroy() {
      var _a;
      this.active = false;
      (_a = this.observer) == null ? void 0 : _a.disconnect();
      this.observer = void 0;
      this.removeInjectedButtons();
      this.releaseAllObjectUrls();
      this.context.logger.info("销毁功能：content-rank-enhance");
    }
    /**
     * 启动 DOM 观察。
     * 只关心新增节点，并把扫描范围限制到新增节点及其子树，避免全量重复遍历。
     */
    startObserver() {
      const target = document.body ?? document.documentElement;
      if (!target) {
        return;
      }
      this.observer = new MutationObserver((mutations) => {
        if (!this.active) {
          return;
        }
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (!(node instanceof Element)) {
              continue;
            }
            this.scanWithin(node);
          }
        }
      });
      this.observer.observe(target, {
        childList: true,
        subtree: true
      });
    }
    /**
     * 在给定根节点内扫描所有视频卡片。
     * 同一卡片会通过数据标记防止重复注入。
     */
    scanWithin(root) {
      if (!this.active) {
        return;
      }
      for (const card of collectVideoCards(root)) {
        this.mountDownloadButton(card);
      }
    }
    /**
     * 为单个视频卡片挂载下载按钮。
     * 若宿主节点缺失或当前卡片已挂载，则直接跳过。
     */
    mountDownloadButton(card) {
      if (card.dataset[mountedMarkerName] === "true") {
        return;
      }
      const host = card.querySelector(actionHostSelector);
      if (!host) {
        return;
      }
      const button = createDownloadButton(() => this.handleDownload(card, button));
      const closeIcon = host.querySelector("img");
      host.insertBefore(button, closeIcon ?? null);
      card.dataset[mountedMarkerName] = "true";
    }
    /**
     * 处理下载按钮点击。
     * 从当前卡片定位标题与视频地址，下载为 Blob 后触发浏览器保存。
     */
    async handleDownload(card, button) {
      if (button.disabled) {
        return;
      }
      button.disabled = true;
      try {
        const videoUrl = getVideoSource(card);
        const fileName = buildVideoFileName(card);
        await this.downloadVideo(videoUrl, fileName);
      } catch (error) {
        this.context.logger.error("内容榜单视频下载失败", error);
        Toast.error(formatErrorMessage(error));
      } finally {
        button.disabled = false;
      }
    }
    /**
     * 下载视频并触发浏览器保存。
     * 这里显式校验响应状态，避免把失败响应误当作视频文件落地。
     */
    async downloadVideo(videoUrl, fileName) {
      const response = await fetch(videoUrl);
      if (!response.ok) {
        throw new Error(`视频下载失败: ${response.status}`);
      }
      const blob = await response.blob();
      const objectUrl = this.createObjectUrl(blob);
      triggerBrowserDownload(objectUrl, fileName);
      this.releaseObjectUrl(objectUrl);
    }
    /**
     * 创建对象 URL 并登记到实例级集合中。
     * 这样即使中途抛错，销毁阶段仍然可以兜底回收。
     */
    createObjectUrl(blob) {
      const objectUrl = URL.createObjectURL(blob);
      this.objectUrls.add(objectUrl);
      return objectUrl;
    }
    /**
     * 释放单个对象 URL。
     * 释放后会同步从登记集合中移除，避免 destroy 阶段重复处理。
     */
    releaseObjectUrl(objectUrl) {
      if (!this.objectUrls.has(objectUrl)) {
        return;
      }
      URL.revokeObjectURL(objectUrl);
      this.objectUrls.delete(objectUrl);
    }
    /**
     * 释放所有仍未回收的对象 URL。
     * 用于功能销毁阶段的清理。
     */
    releaseAllObjectUrls() {
      for (const objectUrl of this.objectUrls) {
        URL.revokeObjectURL(objectUrl);
      }
      this.objectUrls.clear();
    }
    /**
     * 移除当前实例注入的所有下载按钮。
     * 同时清除卡片上的挂载标记，避免残留状态影响后续重新初始化。
     */
    removeInjectedButtons() {
      for (const button of document.querySelectorAll(`.${downloadButtonClassName}`)) {
        button.remove();
      }
      for (const card of document.querySelectorAll(videoCardSelector)) {
        delete card.dataset[mountedMarkerName];
      }
    }
  }
  function collectVideoCards(root) {
    const cards = [];
    if (root instanceof HTMLElement && root.matches(videoCardSelector)) {
      cards.push(root);
    }
    if (!(root instanceof Element || root instanceof Document)) {
      return cards;
    }
    for (const card of root.querySelectorAll(videoCardSelector)) {
      cards.push(card);
    }
    return cards;
  }
  function createDownloadButton(onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = downloadButtonClassName;
    button.title = downloadButtonTitle;
    button.setAttribute("aria-label", downloadButtonTitle);
    button.innerHTML = getDownloadIconSvg();
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void onClick();
    });
    return button;
  }
  function getVideoSource(card) {
    var _a, _b;
    const src = (_b = (_a = card.querySelector("video")) == null ? void 0 : _a.getAttribute("src")) == null ? void 0 : _b.trim();
    if (!src) {
      throw new Error("未找到可下载的视频地址");
    }
    return src;
  }
  function buildVideoFileName(card) {
    var _a;
    const titleText = ((_a = card.querySelector(titleSelector)) == null ? void 0 : _a.textContent) ?? "";
    const cleanedTitle = sanitizeFileName(titleText);
    if (!cleanedTitle) {
      return defaultFileName;
    }
    return `${cleanedTitle}.mp4`;
  }
  function sanitizeFileName(rawText) {
    const normalizedText = rawText.replace(/\s+/g, " ").trim();
    const safeText = normalizedText.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "");
    return safeText.slice(0, 80).trim();
  }
  function triggerBrowserDownload(url, fileName) {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = "noopener";
    anchor.style.display = "none";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  }
  function ensureContentRankButtonStyle() {
    addStyleOnce(
      "doudian-tools-content-rank-enhance",
      `
.${downloadButtonClassName} {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  margin-right: 6px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #909299;
  cursor: pointer;
  vertical-align: middle;
}

.${downloadButtonClassName}:hover:not(:disabled) {
  background: rgba(144, 146, 153, 0.16);
  color: #1f2329;
}

.${downloadButtonClassName}:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.${downloadButtonClassName} svg {
  width: 16px;
  height: 16px;
  pointer-events: none;
}
`
    );
  }
  function formatErrorMessage(error) {
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }
    if (typeof error === "string" && error.trim()) {
      return error;
    }
    return "视频下载失败";
  }
  function getDownloadIconSvg() {
    return `
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M10 3.75C10.4142 3.75 10.75 4.08579 10.75 4.5V10.4393L12.9697 8.21967C13.2626 7.92678 13.7374 7.92678 14.0303 8.21967C14.3232 8.51256 14.3232 8.98744 14.0303 9.28033L10.5303 12.7803C10.2374 13.0732 9.76256 13.0732 9.46967 12.7803L5.96967 9.28033C5.67678 8.98744 5.67678 8.51256 5.96967 8.21967C6.26256 7.92678 6.73744 7.92678 7.03033 8.21967L9.25 10.4393V4.5C9.25 4.08579 9.58579 3.75 10 3.75Z"
        fill="currentColor"
      />
      <path
        d="M4.5 13.25C4.91421 13.25 5.25 13.5858 5.25 14V14.25C5.25 14.5261 5.47386 14.75 5.75 14.75H14.25C14.5261 14.75 14.75 14.5261 14.75 14.25V14C14.75 13.5858 15.0858 13.25 15.5 13.25C15.9142 13.25 16.25 13.5858 16.25 14V14.25C16.25 15.3546 15.3546 16.25 14.25 16.25H5.75C4.64543 16.25 3.75 15.3546 3.75 14.25V14C3.75 13.5858 4.08579 13.25 4.5 13.25Z"
        fill="currentColor"
      />
    </svg>
  `;
  }
  const contentRankEnhanceFeature = {
    id: "content-rank-enhance",
    name: "内容榜单增强",
    description: "在内容榜单视频卡片中注入下载按钮，支持直接下载当前预览视频",
    matches: [/compass\.jinritemai\.com\/shop\/chance\/rank-video/],
    defaultEnabled: true,
    create: (context) => new ContentRankEnhanceFeature(context)
  };
  const targetContainerSelector = ".img-default-wrapper, .ecom-dorami-info-card-avatar";
  const previewClassName = "ddt-product-image-preview";
  const previewImageClassName = "ddt-product-image-preview-image";
  const defaultPreviewSize = 320;
  const minimumPreviewSize = 100;
  const maximumPreviewSize = 800;
  const previewSizeStep = 40;
  const previewOffset = 12;
  const viewportPadding = 8;
  class ProductImagePreviewFeature {
    constructor(context) {
      this.context = context;
      this.previewSize = defaultPreviewSize;
      this.onMouseOver = (event) => this.showPreview(event);
      this.onMouseMove = (event) => this.movePreview(event);
      this.onMouseOut = (event) => this.hidePreview(event);
      this.onWheel = (event) => this.resizePreview(event);
    }
    /** 立即创建预览层并注册文档级事件委托，异步图片无需单独挂载。 */
    init() {
      ensurePreviewStyle();
      this.createPreview();
      document.addEventListener("mouseover", this.onMouseOver);
      document.addEventListener("mousemove", this.onMouseMove);
      document.addEventListener("mouseout", this.onMouseOut);
      document.addEventListener("wheel", this.onWheel, { passive: false });
      this.context.logger.info("初始化功能：product-image-preview");
    }
    /** 销毁预览层并解除所有监听，防止 SPA 路由切换后残留交互。 */
    destroy() {
      var _a;
      document.removeEventListener("mouseover", this.onMouseOver);
      document.removeEventListener("mousemove", this.onMouseMove);
      document.removeEventListener("mouseout", this.onMouseOut);
      document.removeEventListener("wheel", this.onWheel);
      (_a = this.preview) == null ? void 0 : _a.remove();
      this.preview = void 0;
      this.previewImage = void 0;
      this.activeImage = void 0;
      this.activeContainer = void 0;
      this.context.logger.info("销毁功能：product-image-preview");
    }
    /** 创建唯一的固定定位预览层。 */
    createPreview() {
      const preview = document.createElement("div");
      const previewImage = document.createElement("img");
      preview.className = previewClassName;
      preview.style.display = "none";
      previewImage.className = previewImageClassName;
      preview.append(previewImage);
      const root = document.body ?? document.documentElement;
      root.append(preview);
      this.preview = preview;
      this.previewImage = previewImage;
    }
    /** 鼠标进入目标缩略图时显示对应原图。 */
    showPreview(event) {
      const container = findTargetContainer(event.target);
      const image = container == null ? void 0 : container.querySelector("img");
      const source = (image == null ? void 0 : image.currentSrc) || (image == null ? void 0 : image.src);
      if (!container || !image || !source || !this.preview || !this.previewImage) {
        return;
      }
      this.activeImage = image;
      this.activeContainer = container;
      this.previewSize = defaultPreviewSize;
      this.previewImage.src = source;
      this.applyPreviewSize();
      this.preview.style.display = "block";
      this.positionPreview(event);
    }
    /** 鼠标移动时让预览层持续贴近指针。 */
    movePreview(event) {
      if (!this.activeImage || !this.preview) {
        return;
      }
      this.positionPreview(event);
    }
    /** 离开当前目标缩略图后隐藏预览层。 */
    hidePreview(event) {
      if (!this.activeImage || !this.activeContainer || !this.preview) {
        return;
      }
      const container = findTargetContainer(event.target);
      if (container !== this.activeContainer || isMovingWithinContainer(event.relatedTarget, this.activeContainer)) {
        return;
      }
      this.activeImage = void 0;
      this.activeContainer = void 0;
      this.preview.style.display = "none";
    }
    /** 预览显示期间拦截滚轮，并按固定步长调整预览宽度。 */
    resizePreview(event) {
      if (!this.activeImage || !this.preview || !this.previewImage) {
        return;
      }
      event.preventDefault();
      const sizeChange = event.deltaY < 0 ? previewSizeStep : -previewSizeStep;
      this.previewSize = clamp(this.previewSize + sizeChange, minimumPreviewSize, maximumPreviewSize);
      this.applyPreviewSize();
      this.positionPreview(event);
    }
    /** 应用当前尺寸，图片高度由浏览器按原始比例自动计算。 */
    applyPreviewSize() {
      if (!this.previewImage) {
        return;
      }
      this.previewImage.style.width = `${this.previewSize}px`;
    }
    /** 根据预览当前尺寸选择靠近指针且位于视口内的一侧。 */
    positionPreview(event) {
      if (!this.preview) {
        return;
      }
      const bounds = this.preview.getBoundingClientRect();
      const left = getPreviewCoordinate(event.clientX, bounds.width, window.innerWidth);
      const top = getPreviewCoordinate(event.clientY, bounds.height, window.innerHeight);
      this.preview.style.left = `${left}px`;
      this.preview.style.top = `${top}px`;
    }
  }
  function findTargetContainer(target) {
    if (!(target instanceof Element)) {
      return void 0;
    }
    return target.closest(targetContainerSelector) ?? void 0;
  }
  function isMovingWithinContainer(target, container) {
    return target instanceof Node && container.contains(target);
  }
  function getPreviewCoordinate(pointer, previewLength, viewportLength) {
    const forward = pointer + previewOffset;
    if (forward + previewLength <= viewportLength - viewportPadding) {
      return forward;
    }
    return Math.max(viewportPadding, pointer - previewLength - previewOffset);
  }
  function clamp(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), maximum);
  }
  function ensurePreviewStyle() {
    addStyleOnce(
      "doudian-tools-product-image-preview",
      `
.${previewClassName} {
  position: fixed;
  z-index: 2147483647;
  display: none;
  max-width: calc(100vw - ${viewportPadding * 2}px);
  max-height: calc(100vh - ${viewportPadding * 2}px);
  padding: 4px;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 4px;
  background: #ffffff;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  pointer-events: none;
}

.${previewImageClassName} {
  display: block;
  width: ${defaultPreviewSize}px;
  max-width: calc(100vw - ${viewportPadding * 2 + 8}px);
  max-height: calc(100vh - ${viewportPadding * 2 + 8}px);
  height: auto;
  object-fit: contain;
}
`
    );
  }
  const productImagePreviewFeature = {
    id: "product-image-preview",
    name: "商品图片悬浮预览",
    description: "悬浮商品缩略图显示大图，并支持滚轮缩放预览尺寸",
    matches: [
      /compass\.jinritemai\.com\/shop\/commodity\/product-list/,
      /compass\.jinritemai\.com\/shop\/merchandise-traffic/,
      /compass\.jinritemai\.com\/shop\/chance\/product-rank/,
      /compass\.jinritemai\.com\/shop\/chance\/rank-product/
    ],
    defaultEnabled: true,
    create: (context) => new ProductImagePreviewFeature(context)
  };
  const allFeatures = [
    productListFeature,
    liveControlFeature,
    liveStockPreviewFeature,
    productEditFeature,
    liveScreenFeature,
    shopRankFeature,
    batchAuthApplyFeature,
    contentRankEnhanceFeature,
    productImagePreviewFeature
  ];
  class EventBus {
    constructor() {
      this.handlers = /* @__PURE__ */ new Map();
    }
    on(eventName, handler) {
      const handlers = this.handlers.get(eventName) ?? /* @__PURE__ */ new Set();
      handlers.add(handler);
      this.handlers.set(eventName, handlers);
      return () => {
        handlers.delete(handler);
      };
    }
    emit(eventName, payload) {
      const handlers = this.handlers.get(eventName);
      if (!handlers) return;
      for (const handler of [...handlers]) {
        handler(payload);
      }
    }
  }
  class Logger {
    constructor(prefix = "DoudianTools") {
      this.prefix = prefix;
    }
    child(scope) {
      return new Logger(`${this.prefix}:${scope}`);
    }
    debug(message, ...args) {
    }
    info(message, ...args) {
      console.info(this.formatWithCaller(message), ...args);
    }
    warn(message, ...args) {
      console.warn(this.formatWithCaller(message), ...args);
    }
    error(message, ...args) {
      console.error(this.formatWithCaller(message), ...args);
    }
    format(message) {
      return `[${this.prefix}] ${message}`;
    }
    formatWithCaller(message) {
      const formatted = this.format(message);
      {
        return formatted;
      }
    }
  }
  const _RequestListenerManagerImpl = class _RequestListenerManagerImpl {
    constructor() {
      this.listeners = /* @__PURE__ */ new Map();
      this.recentRequests = [];
      this.recentResponses = [];
      this.xhrRequestMeta = /* @__PURE__ */ new WeakMap();
      this.started = false;
    }
    start() {
      if (this.started) return;
      this.started = true;
      this.hookFetch();
      this.hookXMLHttpRequest();
    }
    stop() {
      if (!this.started) return;
      if (this.originalFetch) {
        globalThis.fetch = this.originalFetch;
        this.originalFetch = void 0;
      }
      if (this.originalXhrOpen && typeof XMLHttpRequest !== "undefined") {
        XMLHttpRequest.prototype.open = this.originalXhrOpen;
        this.originalXhrOpen = void 0;
      }
      if (this.originalXhrSend && typeof XMLHttpRequest !== "undefined") {
        XMLHttpRequest.prototype.send = this.originalXhrSend;
        this.originalXhrSend = void 0;
      }
      this.recentRequests.length = 0;
      this.recentResponses.length = 0;
      this.started = false;
    }
    add(listener) {
      if (this.listeners.has(listener.id)) {
        throw new Error(`请求监听器 id 重复: ${listener.id}`);
      }
      this.listeners.set(listener.id, listener);
      void this.replayRecentEvents(listener);
      return listener.id;
    }
    remove(id) {
      this.listeners.delete(id);
    }
    async dispatch(payload) {
      this.rememberResponse(payload);
      for (const listener of this.listeners.values()) {
        if (!listener.onResponse || !this.matches(listener, payload)) {
          continue;
        }
        try {
          await listener.onResponse(payload);
        } catch (error) {
          console.error(`请求监听器执行失败: ${listener.id}`, error);
        }
      }
    }
    async dispatchRequest(payload) {
      this.rememberRequest(payload);
      for (const listener of this.listeners.values()) {
        if (!listener.onRequest || !this.matches(listener, payload)) {
          continue;
        }
        try {
          await listener.onRequest(payload);
        } catch (error) {
          console.error(`请求发起监听器执行失败: ${listener.id}`, error);
        }
      }
    }
    async replayRecentEvents(listener) {
      if (listener.onRequest) {
        for (const payload of this.recentRequests) {
          if (!this.matches(listener, payload)) {
            continue;
          }
          try {
            await listener.onRequest(payload);
          } catch (error) {
            console.error(`请求发起监听器执行失败: ${listener.id}`, error);
          }
        }
      }
      if (listener.onResponse) {
        for (const payload of this.recentResponses) {
          if (!this.matches(listener, payload)) {
            continue;
          }
          try {
            await listener.onResponse(payload);
          } catch (error) {
            console.error(`请求监听器执行失败: ${listener.id}`, error);
          }
        }
      }
    }
    rememberRequest(payload) {
      this.recentRequests.push(payload);
      if (this.recentRequests.length > _RequestListenerManagerImpl.maxReplayEntries) {
        this.recentRequests.shift();
      }
    }
    rememberResponse(payload) {
      this.recentResponses.push(payload);
      if (this.recentResponses.length > _RequestListenerManagerImpl.maxReplayEntries) {
        this.recentResponses.shift();
      }
    }
    matches(listener, payload) {
      listener.match.lastIndex = 0;
      if (!listener.match.test(payload.url)) {
        return false;
      }
      if (!listener.methods || listener.methods.length === 0) {
        return true;
      }
      const method = payload.method.toUpperCase();
      return listener.methods.some((item) => item.toUpperCase() === method);
    }
    hookFetch() {
      if (typeof globalThis.fetch !== "function") return;
      const originalFetch = globalThis.fetch;
      this.originalFetch = originalFetch;
      globalThis.fetch = async (input, init) => {
        const url = getFetchUrl(input);
        const method = getFetchMethod(input, init);
        if (this.started) {
          void this.dispatchRequest(createRequestPayload(url, method));
        }
        const response = await originalFetch.call(globalThis, input, init);
        void response.clone().text().then((text) => {
          if (!this.started) return;
          void this.dispatch(createPayload(url, method, response.status, text));
        }).catch((error) => {
          console.error("请求监听器读取 fetch 响应失败", error);
        });
        return response;
      };
    }
    hookXMLHttpRequest() {
      if (typeof XMLHttpRequest === "undefined") return;
      const originalOpen = XMLHttpRequest.prototype.open;
      const originalSend = XMLHttpRequest.prototype.send;
      const manager = this;
      this.originalXhrOpen = originalOpen;
      this.originalXhrSend = originalSend;
      XMLHttpRequest.prototype.open = function(method, url, async, username, password) {
        manager.xhrRequestMeta.set(this, {
          method: method.toUpperCase(),
          rawUrl: String(url),
          normalizedUrl: normalizeRequestUrl(url),
          responseDispatched: false,
          requestStarted: false
        });
        const patchedXhr = this;
        if (!patchedXhr.__ddtResponsePatched) {
          this.addEventListener("loadend", () => {
            const currentMeta = manager.xhrRequestMeta.get(this);
            if (!currentMeta || currentMeta.responseDispatched || !manager.started) {
              return;
            }
            currentMeta.responseDispatched = true;
            const responseUrl = getXhrResponseUrl(this) || (currentMeta.requestStarted ? currentMeta.normalizedUrl : currentMeta.rawUrl);
            void manager.dispatch(createPayload(
              responseUrl,
              currentMeta.method,
              getXhrStatus(this),
              getXhrResponseText(this)
            ));
          });
          patchedXhr.__ddtResponsePatched = true;
        }
        if (async === void 0) {
          return originalOpen.call(this, method, url, true);
        }
        return originalOpen.call(this, method, url, async, username, password);
      };
      XMLHttpRequest.prototype.send = function(body) {
        const xhr = this;
        const meta = manager.xhrRequestMeta.get(xhr);
        if (meta) {
          meta.requestStarted = true;
        }
        if (manager.started && meta) {
          void manager.dispatchRequest(createRequestPayload(meta.normalizedUrl, meta.method));
        }
        const dispatchResponse = () => {
          const currentMeta = manager.xhrRequestMeta.get(xhr);
          if (!currentMeta || currentMeta.responseDispatched || !manager.started) {
            return;
          }
          currentMeta.responseDispatched = true;
          const responseUrl = getXhrResponseUrl(xhr) || currentMeta.normalizedUrl;
          void manager.dispatch(createPayload(responseUrl, currentMeta.method, getXhrStatus(xhr), getXhrResponseText(xhr)));
        };
        const originalOnload = xhr.onload;
        xhr.onload = function(event) {
          dispatchResponse();
          return originalOnload == null ? void 0 : originalOnload.call(this, event);
        };
        return originalSend.call(xhr, body);
      };
    }
  };
  _RequestListenerManagerImpl.maxReplayEntries = 20;
  let RequestListenerManagerImpl = _RequestListenerManagerImpl;
  function getFetchUrl(input) {
    if (typeof Request !== "undefined" && input instanceof Request) {
      return input.url;
    }
    return String(input);
  }
  function getFetchMethod(input, init) {
    if (init == null ? void 0 : init.method) {
      return init.method.toUpperCase();
    }
    if (typeof Request !== "undefined" && input instanceof Request) {
      return input.method.toUpperCase();
    }
    return "GET";
  }
  function getXhrStatus(xhr) {
    try {
      return xhr.status;
    } catch {
      return 0;
    }
  }
  function getXhrResponseText(xhr) {
    try {
      return xhr.responseText;
    } catch {
      return "";
    }
  }
  function getXhrResponseUrl(xhr) {
    try {
      return xhr.responseURL;
    } catch {
      return "";
    }
  }
  function createRequestPayload(url, method) {
    return {
      url,
      method: method.toUpperCase()
    };
  }
  function createPayload(url, method, status, text) {
    return {
      url,
      method: method.toUpperCase(),
      status,
      text,
      json: parseJson(text)
    };
  }
  function normalizeRequestUrl(url) {
    const value = String(url);
    try {
      if (typeof location !== "undefined" && location.origin) {
        return new URL(value, location.origin).toString();
      }
      return new URL(value).toString();
    } catch {
      return value;
    }
  }
  function parseJson(text) {
    if (!text.trim()) return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
  function createAppContext() {
    return {
      logger: new Logger(),
      events: new EventBus(),
      requestListener: new RequestListenerManagerImpl()
    };
  }
  class App {
    constructor() {
      this.context = createAppContext();
      this.registry = new FeatureRegistry();
      this.config = new AppConfigStore(allFeatures);
      this.started = false;
      this.featuresRegistered = false;
      this.stopRequested = false;
    }
    async start() {
      if (this.started) {
        return;
      }
      if (this.startPromise) {
        return this.startPromise;
      }
      this.stopRequested = false;
      this.startPromise = this.startInternal().finally(() => {
        this.startPromise = void 0;
      });
      return this.startPromise;
    }
    async stop() {
      this.stopRequested = true;
      if (this.startPromise) {
        await this.startPromise.catch(() => void 0);
      }
      if (!this.started && !this.router && !this.lifecycle && !this.unregisterMenu) {
        return;
      }
      await this.teardown();
    }
    dispose() {
      return this.stop();
    }
    openSettings() {
      if (!this.router) {
        throw new Error("应用尚未启动");
      }
      new SettingsPanel({
        config: this.config,
        features: this.registry.getAll(),
        onSaved: () => {
          var _a;
          return (_a = this.router) == null ? void 0 : _a.reconcile(true);
        }
      }).open();
    }
    async startInternal() {
      try {
        if (!this.featuresRegistered) {
          this.registry.registerMany(allFeatures);
          this.featuresRegistered = true;
        }
        await this.config.load();
        if (this.stopRequested) {
          await this.teardown();
          return;
        }
        this.context.requestListener.start();
        this.lifecycle = new FeatureLifecycle({
          appConfig: this.config,
          requestListener: this.context.requestListener,
          events: this.context.events,
          logger: this.context.logger
        });
        this.router = new Router(this.registry, this.config, this.lifecycle, this.context.logger);
        this.unregisterMenu = registerMenuCommand("抖店工具箱设置", () => {
          void this.openSettings();
        });
        if (this.stopRequested) {
          await this.teardown();
          return;
        }
        this.router.start();
        if (this.stopRequested) {
          await this.teardown();
          return;
        }
        this.started = true;
        this.context.logger.info("应用已启动");
      } catch (error) {
        await this.teardown();
        throw error;
      }
    }
    async teardown() {
      const router = this.router;
      const lifecycle = this.lifecycle;
      const unregisterMenu = this.unregisterMenu;
      this.router = void 0;
      this.lifecycle = void 0;
      this.unregisterMenu = void 0;
      this.started = false;
      if (router) {
        await router.stop();
      } else if (lifecycle) {
        await lifecycle.stop();
      }
      unregisterMenu == null ? void 0 : unregisterMenu();
      this.context.requestListener.stop();
    }
  }
  async function bootstrap() {
    const app = new App();
    try {
      await app.start();
      window.__DOUDIAN_TOOLS__ = app;
      return app;
    } catch (error) {
      console.error("抖店工具箱启动失败", error);
      return void 0;
    }
  }
  void bootstrap();
})();
