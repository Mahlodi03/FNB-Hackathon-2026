import { notFound } from "next/navigation";
import { demoTasks } from "@/content/demo";
import { AssessmentPreview } from "@/features/assessments/AssessmentPreview";
export default async function Assessment({params}:{params:Promise<{taskId:string}>}) {
 const {taskId}=await params; const task=demoTasks.find(t=>t.id===taskId);if(!task)notFound();
 return <section style={{paddingTop:35,maxWidth:830}}><div className="eyebrow">Assessment workspace</div><h1 className="h2" style={{margin:"9px 0 20px"}}>{task.title}</h1><AssessmentPreview task={task}/></section>;
}
