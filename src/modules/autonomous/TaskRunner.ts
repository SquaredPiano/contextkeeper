import { DeveloperContext } from '../../services/interfaces';

export interface IAutonomousTask {
    name: string;
    description: string;
    run(context: DeveloperContext): Promise<void>;
}

export class TaskRegistry {
    private tasks: Map<string, IAutonomousTask> = new Map();

    register(task: IAutonomousTask) {
        this.tasks.set(task.name, task);
        console.log(`[TaskRegistry] Registered task: ${task.name}`);
    }

    get(name: string): IAutonomousTask | undefined {
        return this.tasks.get(name);
    }

    getAll(): IAutonomousTask[] {
        return Array.from(this.tasks.values());
    }
}
