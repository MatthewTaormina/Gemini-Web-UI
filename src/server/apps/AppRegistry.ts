import { StorageService } from './storage/StorageService.js';
import { Router } from 'express';

// Define the interface for a Server-Side App Module
export interface ServerAppModule {
    id: string;
    name: string;
    init: (context: AppContext) => Promise<void>;
    router?: Router; // Optional Express Router to mount at /api/apps/{id}
}

export interface AppContext {
    storage: StorageService;
    // Add DB, Logger, EventBus here later
}

class AppRegistry {
    private apps: Map<string, ServerAppModule> = new Map();
    private context: AppContext;

    constructor() {
        this.context = {
            storage: new StorageService()
        };
    }

    register(app: ServerAppModule) {
        if (this.apps.has(app.id)) {
            throw new Error(`App ${app.id} is already registered.`);
        }
        this.apps.set(app.id, app);
        console.log(`[AppRegistry] Registered: ${app.name} (${app.id})`);
    }

    async initializeAll() {
        for (const app of this.apps.values()) {
            try {
                await app.init(this.context);
                console.log(`[AppRegistry] Initialized: ${app.id}`);
            } catch (err) {
                console.error(`[AppRegistry] Failed to init ${app.id}:`, err);
            }
        }
    }

    getApp(id: string) {
        return this.apps.get(id);
    }
}

export const appRegistry = new AppRegistry();
