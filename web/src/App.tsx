import { useState, useEffect } from 'react';
import type { Task, CreateTaskPayload } from './types/task';
import { TaskService } from './services/api';

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await TaskService.getTasks();
      setTasks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTasks(); }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!title.trim()) return;
    setIsSubmitting(true);
    setError(null);

    const payload: CreateTaskPayload = {
      title: title.trim(),
      description: description.trim() || undefined,
      creatorId: '550e8400-e29b-41d4-a716-446655440000',
      assigneeId: '123e4567-e89b-12d3-a456-426614174000',
      dueDate: new Date(Date.now() + 86400000).toISOString(),
    };

    try {
      await TaskService.createTask(payload);
      setTitle('');
      setDescription('');
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handles the state transition of a task to COMPLETED.
   */
  const handleCompleteTask = async (id: string) => {
    try {
      await TaskService.updateTaskStatus(id, 'COMPLETED');
      await loadTasks(); // Refresh list to reflect changes
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete task.');
    }
  };

  /**
   * Handles the logical deletion of a task.
   */
  const handleDeleteTask = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      await TaskService.deleteTask(id);
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans p-6 md:p-12">
      <div className="max-w-5xl mx-auto space-y-8">

        <header className="text-center space-y-2">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight sm:text-4xl">
            Event-Driven Task Manager
          </h1>
          <p className="text-lg text-gray-500">
            Senior Full-Stack Assessment Implementation
          </p>
        </header>

        {error && (
          <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-md">
            <p className="text-sm font-medium text-red-700">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Creation Form (Sidebar) */}
          <aside className="md:col-span-1">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 sticky top-6">
              <h2 className="text-lg font-semibold mb-4 text-gray-800">New Task</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <input id="title" type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea id="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
                </div>
                <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors disabled:bg-blue-300">
                  {isSubmitting ? 'Dispatching...' : 'Create Task'}
                </button>
              </form>
            </div>
          </aside>

          {/* Task List (Main Content) */}
          <main className="md:col-span-2">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-h-[400px]">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-semibold text-gray-800">Active Tasks</h2>
                <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">{tasks.length}</span>
              </div>

              {loading ? (
                <div className="flex justify-center h-32 items-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
              ) : tasks.length === 0 ? (
                <div className="text-center py-12"><p className="text-gray-500">No active tasks found.</p></div>
              ) : (
                <div className="space-y-4">
                  {tasks.map((task) => (
                    <article key={task.id} className="group p-5 border border-gray-200 rounded-lg hover:border-blue-300 bg-gray-50 hover:bg-white transition-all">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className={`text-md font-semibold transition-colors ${task.status === 'COMPLETED' ? 'text-gray-400 line-through' : 'text-gray-900 group-hover:text-blue-700'}`}>
                          {task.title}
                        </h3>
                        <div className="flex gap-2">
                          <span className={`text-xs font-bold px-2 py-1 rounded-md uppercase ${task.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                            {task.status}
                          </span>
                        </div>
                      </div>

                      {task.description && <p className={`text-sm mb-4 line-clamp-2 ${task.status === 'COMPLETED' ? 'text-gray-400' : 'text-gray-600'}`}>{task.description}</p>}

                      <div className="flex items-center justify-between border-t border-gray-200 pt-3 mt-3">
                        <div className="text-xs text-gray-500 space-x-4">
                          <span><strong>Due:</strong> {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'None'}</span>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {task.status !== 'COMPLETED' && (
                            <button onClick={() => handleCompleteTask(task.id)} className="text-xs font-medium text-green-600 hover:text-green-800 bg-green-50 px-2 py-1 rounded border border-green-200">
                              Complete
                            </button>
                          )}
                          <button onClick={() => handleDeleteTask(task.id)} className="text-xs font-medium text-red-600 hover:text-red-800 bg-red-50 px-2 py-1 rounded border border-red-200">
                            Delete
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}