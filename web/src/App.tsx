import { useState, useEffect } from 'react';
import type { Task, CreateTaskPayload } from './types/task';
import { TaskService } from './services/api';

type ToastInfo = { msg: string; type: 'success' | 'error' } | null;

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Paginación
  const [page, setPage] = useState<number>(1);
  const [lastPage, setLastPage] = useState<number>(1);
  const [totalTasks, setTotalTasks] = useState<number>(0);

  // Formulario
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Notificación Toast
  const [toast, setToast] = useState<ToastInfo>(null);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadTasks = async (currentPage: number) => {
    try {
      setLoading(true);
      const data = await TaskService.getTasks(currentPage, 10);
      setTasks(data.items);
      setLastPage(data.lastPage);
      setTotalTasks(data.total);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error loading tasks', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTasks(page); }, [page]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return; // Anti-Spam / Throttle

    setIsSubmitting(true);

    const payload: CreateTaskPayload = {
      title: title.trim(),
      description: description.trim() || undefined,
      creatorId: '550e8400-e29b-41d4-a716-446655440000',
      assigneeId: '123e4567-e89b-12d3-a456-426614174000',
      dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
    };

    try {
      await TaskService.createTask(payload);
      setTitle('');
      setDescription('');
      setDueDate('');
      showToast('Task created successfully!', 'success');
      page === 1 ? await loadTasks(1) : setPage(1);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create task', 'error');
    } finally {
      setTimeout(() => setIsSubmitting(false), 800); // 800ms cooldown para evitar multi-clicks
    }
  };

  const handleCompleteTask = async (id: string) => {
    try {
      await TaskService.updateTaskStatus(id, 'COMPLETED');
      showToast('Task completed', 'success');
      await loadTasks(page);
    } catch (err) {
      showToast('Failed to complete', 'error');
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await TaskService.deleteTask(id);
      showToast('Task deleted', 'success');
      await loadTasks(page);
    } catch (err) {
      showToast('Failed to delete', 'error');
    }
  };

  const handleTriggerCronjob = async () => {
    try {
      await TaskService.triggerReminders();
      showToast('Cronjob simulation triggered', 'success');
    } catch (err) {
      showToast('Cronjob failed', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans p-6 md:p-12 relative">

      {/* Toast Notification en lugar de alert() */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-6 py-4 rounded-lg shadow-lg border-l-4 transition-all duration-300 ${toast.type === 'success' ? 'bg-green-50 border-green-500 text-green-800' : 'bg-red-50 border-red-500 text-red-800'}`}>
          <p className="font-semibold">{toast.msg}</p>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900">Event-Driven Tasks</h1>
            <p className="text-gray-500">Senior Full-Stack Architecture</p>
          </div>
          <button onClick={handleTriggerCronjob} className="mt-4 md:mt-0 flex items-center gap-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-semibold py-2 px-4 rounded-lg transition-colors border border-indigo-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            Trigger Cronjob
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sidebar Formulario */}
          <aside className="lg:col-span-1">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 sticky top-6">
              <h2 className="text-lg font-semibold mb-4">New Task</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date & Time</label>
                  <input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-700" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
                </div>
                <button type="submit" disabled={isSubmitting} className="w-full flex justify-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed">
                  {isSubmitting ? (
                    <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  ) : 'Create Task'}
                </button>
              </form>
            </div>
          </aside>

          {/* Listado y Paginación */}
          <main className="lg:col-span-2 flex flex-col">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex-grow">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-semibold">Active Tasks</h2>
                <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">Total: {totalTasks}</span>
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
                        <h3 className={`text-md font-semibold ${task.status === 'COMPLETED' ? 'text-gray-400 line-through' : 'text-gray-900 group-hover:text-blue-700'}`}>{task.title}</h3>
                        <span className={`text-xs font-bold px-2 py-1 rounded-md uppercase ${task.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{task.status}</span>
                      </div>
                      {task.description && <p className="text-sm mb-4 text-gray-600">{task.description}</p>}
                      <div className="flex items-center justify-between border-t border-gray-200 pt-3 mt-3">
                        <div className="text-xs text-gray-500">
                          <strong>Due:</strong> {task.dueDate ? new Date(task.dueDate).toLocaleString() : 'N/A'}
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {task.status !== 'COMPLETED' && (
                            <button onClick={() => handleCompleteTask(task.id)} className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded border border-green-200">Complete</button>
                          )}
                          <button onClick={() => handleDeleteTask(task.id)} className="text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded border border-red-200">Delete</button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>

            {/* Controles de Paginación */}
            {totalTasks > 0 && (
              <div className="mt-6 flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || loading} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50">Previous</button>
                <span className="text-sm font-medium text-gray-600">Page {page} of {lastPage}</span>
                <button onClick={() => setPage(p => Math.min(lastPage, p + 1))} disabled={page === lastPage || loading} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50">Next</button>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}