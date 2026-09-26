import { Link } from "react-router-dom";
import AgShell from "../components/AgShell.jsx";

function NotFound() {
  return (
    <AgShell>
      <main className="ag-hero">
        <h1 className="ag-title ag-split">Lost in space.</h1>
        <p className="ag-sub ag-reveal">This page doesn&apos;t exist.</p>
        <div className="ag-ctas ag-reveal">
          <Link to="/" className="ag-pill">
            Go home
          </Link>
        </div>
      </main>
    </AgShell>
  );
}

export default NotFound;
