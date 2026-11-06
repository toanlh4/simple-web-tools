import { Link } from 'react-router-dom';
import { tools } from '../tools/registry';

export function HomePage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-xl font-semibold">Tools</h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Small utilities that run entirely in your browser.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link
              key={tool.id}
              to={tool.path}
              className="group rounded-lg border border-gray-200 bg-white p-4 transition hover:border-blue-400 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-500"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="font-medium group-hover:text-blue-600 dark:group-hover:text-blue-400">{tool.name}</span>
              </div>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{tool.description}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
