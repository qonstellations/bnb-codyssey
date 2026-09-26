// Raw CSS recreation of the "GradientButton" pattern (21st.dev / kokonutui-style): a continuously
// shifting multi-colour gradient, either as a solid fill ("default") or as an animated border with
// a transparent center ("variant"). No extra dependency — styles live in index.css.
export default function GradientButton({ variant = "default", className = "", ...props }) {
  return (
    <button
      type="button"
      className={`gradient-btn ${variant === "variant" ? "gradient-btn--variant" : ""} ${className}`}
      {...props}
    />
  );
}
