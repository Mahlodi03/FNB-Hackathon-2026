import { TaskSchema, PublicStudentSchema, type Task } from "@/contracts/domain";
const rubric = {
  theoryWeight: 30, practicalWeight: 50, understandingWeight: 20,
  theoryCriteria: ["Correctly explains the concept", "Uses appropriate technical terms"],
  practicalCriteria: ["Approach plausibly addresses requirements", "Handles important edge cases", "Code is readable"],
  understandingCriteria: ["Explains a specific decision in the own submitted solution", "Considers a realistic counterexample"]
};
const examples: Array<[string,string,string,string,string]> = [
 ["oop-inheritance", "Inheritance vs composition", "OOP", "beginner", "Explain when composition is preferable to inheritance."],
 ["arrays-two-sum", "Two-sum problem", "Algorithms", "beginner", "Write a function that finds two indices whose values add to a target."],
 ["sql-join-types", "SQL joins in practice", "SQL", "beginner", "Write SQL to list customers and their most recent orders."],
 ["hash-map-caching", "Hash maps and caching", "Data Structures", "intermediate", "Design a small in-memory cache with lookup and eviction."],
 ["sql-window-functions", "Ranking with SQL", "SQL", "intermediate", "Rank employees by salary in each department using window functions."],
 ["oop-polymorphism", "Polymorphism and interfaces", "OOP", "intermediate", "Implement a common interface for multiple payment method classes."],
 ["algorithms-search", "Binary search edge cases", "Algorithms", "intermediate", "Implement binary search and describe the behaviour for missing values."],
 ["data-cleaning", "Data cleaning pipeline", "Data Science", "beginner", "Write pseudocode or Python for filling missing values safely."],
 ["graph-traversal", "Graph path traversal", "Data Structures", "advanced", "Use BFS to find the shortest path in an unweighted graph."],
 ["sql-query-plans", "Query performance reasoning", "SQL", "advanced", "Rewrite a slow query and explain a suitable index strategy."]
];
export const demoTasks: Task[] = examples.map(([slug,title,concept,difficulty,practicalPrompt],i) => TaskSchema.parse({
 id: `10000000-0000-4000-8000-${String(i+1).padStart(12,"0")}`,
 slug,title,concept,difficulty, durationSeconds: difficulty === "advanced" ? 3600 : 1800,
 theoryPrompt: `Explain the core ${concept} principle used in '${title}' and give a concrete example.`,
 practicalPrompt, understandingGuidance: "Ask about a concrete choice or edge case in the student's own response.",
 rubric, passMark: 70, skills: [concept, "Problem solving"], status: "published"
}));
export const demoStudents = [
 {id:"20000000-0000-4000-8000-000000000001", username:"nomsa-m",fullName:"Nomsa Mokoena",institution:"University of Pretoria",fieldOfInterest:"Software Engineering",bio:"Learning through projects and practical coding challenges.",avatarUrl:null},
 {id:"20000000-0000-4000-8000-000000000002",username:"abo-n",fullName:"Abo Ndlovu",institution:"University of Johannesburg",fieldOfInterest:"Data Science",bio:"Interested in turning data into real business insights.",avatarUrl:null},
 {id:"20000000-0000-4000-8000-000000000003",username:"lerato-k",fullName:"Lerato Khumalo",institution:"Cape Peninsula University of Technology",fieldOfInterest:"Software Engineering",bio:"Building strong foundations in algorithms and SQL.",avatarUrl:null},
].map(x=>PublicStudentSchema.parse(x));
