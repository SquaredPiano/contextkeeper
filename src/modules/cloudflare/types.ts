export type Language = "js" | "ts" | "python" | "go" | "json" | "unknown";
export type Severity = "none" | "low" | "medium" | "high";

export type Risk = {
  message: string;
  severity: Severity;
};

export type CloudflareLintResult = {
    fixed: string;
    language: Language;
    linted: boolean;
    severity: Severity;
    warnings: Risk[];
};
