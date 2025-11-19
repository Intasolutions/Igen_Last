import React from "react";

export default class ErrorBoundary extends React.Component {
  state = { hasError: false, err: null };
  static getDerivedStateFromError(err){ return { hasError: true, err }; }
  componentDidCatch(err, info){ console.error("UI crash:", err, info); }
  render(){
    if (this.state.hasError) {
      return <div style={{padding:24}}>
        <h2>Something went wrong.</h2>
        <pre>{String(this.state.err?.message || this.state.err)}</pre>
      </div>;
    }
    return this.props.children;
  }
}
