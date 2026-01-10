
import { requestUrl, RequestUrlParam } from "obsidian";
import TaskNotesPlugin from "../main";
import { VikunjaSettings } from "../types/settings";

export class VikunjaService {
    plugin: TaskNotesPlugin;
    settings: VikunjaSettings;

    constructor(plugin: TaskNotesPlugin, settings: VikunjaSettings) {
        this.plugin = plugin;
        this.settings = settings;
    }

    private getHeaders() {
        return {
            "Authorization": `Bearer ${this.settings.apiToken}`,
            "Content-Type": "application/json",
        };
    }

    private async request(endpoint: string, method: string = "GET", body?: any): Promise<any> {
        let url = this.settings.apiUrl;
        if (url.endsWith("/")) url = url.slice(0, -1);
        if (!endpoint.startsWith("/")) endpoint = "/" + endpoint;

        const params: RequestUrlParam = {
            url: url + endpoint,
            method: method,
            headers: this.getHeaders(),
        };

        if (body) {
            params.body = JSON.stringify(body);
        }

        try {
            const response = await requestUrl(params);
            if (response.status >= 200 && response.status < 300) {
                return response.json;
            } else {
                console.error("Vikunja API Error:", response);
                throw new Error(`Vikunja API Error: ${response.status}`);
            }
        } catch (error) {
            console.error("Vikunja Request Failed:", error);
            throw error;
        }
    }

    async validateConnection(): Promise<boolean> {
        try {
            // Try to fetch user info or projects to validate token
            await this.request("user");
            return true;
        } catch (error) {
            return false;
        }
    }

    async createTask(listId: number, task: any): Promise<any> {
        return this.request(`projects/${listId}/tasks`, "PUT", task);
    }

    async updateTask(taskId: number, task: any): Promise<any> {
        return this.request(`tasks/${taskId}`, "POST", task);
    }

    async deleteTask(taskId: number): Promise<any> {
        return this.request(`tasks/${taskId}`, "DELETE");
    }

    async getTask(taskId: number): Promise<any> {
        return this.request(`tasks/${taskId}`);
    }

    /**
     * Get tasks from a specific list/project.
     * Use options for filtering/sorting if supported.
     * Vikunja API supports 'filter_by', 'filter_value', 'sort_by', 'order_by'.
     */
    async getTasks(listId: number, options: {
        sort_by?: string[];
        order_by?: string[];
        filter_by?: string[];
        filter_value?: string[];
        page?: number;
    } = {}): Promise<any> {
        const queryParams = new URLSearchParams();

        if (options.sort_by) {
            options.sort_by.forEach(val => queryParams.append("sort_by[]", val));
        }
        if (options.order_by) {
            options.order_by.forEach(val => queryParams.append("order_by[]", val));
        }
        if (options.filter_by) {
            options.filter_by.forEach(val => queryParams.append("filter_by[]", val));
        }
        if (options.filter_value) {
            options.filter_value.forEach(val => queryParams.append("filter_value[]", val));
        }
        if (options.page) {
            queryParams.append("page", options.page.toString());
        }

        const queryString = queryParams.toString();
        const endpoint = `projects/${listId}/tasks${queryString ? '?' + queryString : ''}`;

        return this.request(endpoint);
    }

    async getLabels(page: number = 1, perPage: number = 50): Promise<any> {
        return this.request(`labels?page=${page}&per_page=${perPage}`);
    }

    async createLabel(label: { title: string; description?: string; color?: string }): Promise<any> {
        return this.request("labels", "PUT", label);
    }

    async updateTaskLabels(taskId: number, labels: any[]): Promise<any> {
        // labels array should contain label objects (with id)
        return this.request(`tasks/${taskId}/labels/bulk`, "POST", { labels });
    }
}
