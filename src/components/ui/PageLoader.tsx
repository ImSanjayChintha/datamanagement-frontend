import Spinner from './Spinner';

export default function PageLoader() {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-white/75 dark:bg-gray-950/75 backdrop-blur-[2px]">
      <div className="flex flex-col items-center gap-3">
        <Spinner size="lg" />
        <span className="text-sm text-gray-400 dark:text-gray-500 tracking-wide">
          Loading…
        </span>
      </div>
    </div>
  );
}
