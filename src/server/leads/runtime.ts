import { createAlerter } from "./alert";
import { readLeadsConfig, type LeadsConfig } from "./config";
import { buildNotifiers, type Alerter, type Notifier } from "./notify";
import { SqliteLeadStore, type LeadStore } from "./store";

/** Один экземпляр хранилища и каналов на процесс сервера. */
type Runtime = { config: LeadsConfig; store: LeadStore; notifiers: Notifier[]; alert: Alerter };

let runtime: Runtime | undefined;

export function getLeadsRuntime(): Runtime {
  if (!runtime) {
    const config = readLeadsConfig();
    const store = new SqliteLeadStore(config.storage.path);
    runtime = {
      config,
      store,
      notifiers: buildNotifiers(config.notify),
      alert: createAlerter({ store, webhookUrl: config.alertWebhookUrl }),
    };
  }
  return runtime;
}
