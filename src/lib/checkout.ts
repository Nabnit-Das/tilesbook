export type PlanChoice='trial'|'basic'|'pro';
interface CheckoutProvider {checkout(plan:PlanChoice):Promise<{plan:PlanChoice;status:string;provider:string}>}
export const checkoutProvider:CheckoutProvider={async checkout(plan){return {plan,status:'preview',provider:'stub'};}};
