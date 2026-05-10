import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import Shell from "@/components/Shell";
import { useStore } from "@/lib/store";
import Login from "@/pages/Login";
import Home from "@/pages/Home";
import Markets from "@/pages/Markets";
import Trade from "@/pages/Trade";
import PnL from "@/pages/PnL";
import Agents from "@/pages/Agents";
import Orchestrator from "@/pages/Orchestrator";
import RiskManager from "@/pages/RiskManager";
import Admin from "@/pages/admin/Admin";
import Exchanges from "@/pages/admin/Exchanges";
import Strategies from "@/pages/admin/Strategies";
import Users from "@/pages/admin/Users";
import Audit from "@/pages/admin/Audit";
import TelegramSettings from "@/pages/admin/TelegramSettings";
import SystemSettings from "@/pages/admin/SystemSettings";

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useStore((s) => s.token);
  if (!token) return <Redirect to="/login" />;
  return <Shell>{children}</Shell>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/">
        {() => <PrivateRoute><Home /></PrivateRoute>}
      </Route>
      <Route path="/markets">
        {() => <PrivateRoute><Markets /></PrivateRoute>}
      </Route>
      <Route path="/trade">
        {() => <PrivateRoute><Trade /></PrivateRoute>}
      </Route>
      <Route path="/pnl">
        {() => <PrivateRoute><PnL /></PrivateRoute>}
      </Route>
      <Route path="/agents">
        {() => <PrivateRoute><Agents /></PrivateRoute>}
      </Route>
      <Route path="/orch">
        {() => <PrivateRoute><Orchestrator /></PrivateRoute>}
      </Route>
      <Route path="/risk">
        {() => <PrivateRoute><RiskManager /></PrivateRoute>}
      </Route>
      <Route path="/admin">
        {() => <PrivateRoute><Admin /></PrivateRoute>}
      </Route>
      <Route path="/admin/exchanges">
        {() => <PrivateRoute><Exchanges /></PrivateRoute>}
      </Route>
      <Route path="/admin/strategies">
        {() => <PrivateRoute><Strategies /></PrivateRoute>}
      </Route>
      <Route path="/admin/users">
        {() => <PrivateRoute><Users /></PrivateRoute>}
      </Route>
      <Route path="/admin/audit">
        {() => <PrivateRoute><Audit /></PrivateRoute>}
      </Route>
      <Route path="/admin/telegram">
        {() => <PrivateRoute><TelegramSettings /></PrivateRoute>}
      </Route>
      <Route path="/admin/settings">
        {() => <PrivateRoute><SystemSettings /></PrivateRoute>}
      </Route>
      <Route>
        {() => <Redirect to="/" />}
      </Route>
    </Switch>
  );
}

export default function App() {
  return (
    <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "") ?? ""}>
      <Router />
    </WouterRouter>
  );
}
