// Keep the static export and first client render identical while the hash route resolves.
const StaticShell = () => (
  <div
    className="app-static-shell flex w-full items-center justify-center px-4"
    role="status"
    aria-busy="true"
    aria-label="Loading Mango VPS"
  >
    <div className="app-loading-content flex w-full max-w-xs flex-col items-center text-center">
      <img
        src="/assets/logo.png"
        alt=""
        aria-hidden="true"
        className="app-loading-logo mb-5 h-14 w-14 object-contain"
      />
      <p className="text-sm font-semibold text-foreground">Mango VPS</p>
      <p className="mt-1 text-xs text-muted-foreground">Fetching live server data</p>
      <div className="app-loading-track mt-5 h-1 w-36 overflow-hidden rounded-full" aria-hidden="true">
        <span className="app-loading-sweep block h-full w-1/3 rounded-full" />
      </div>
    </div>
  </div>
);

export default StaticShell;
