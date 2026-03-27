import { Redirect } from "react-router-dom";
import { ProjectsPage } from "./Projects/Projects";
import { OrganizationPage } from "./Organization";
import { ModelsPage } from "./Organization/Models/ModelsPage";
import { FF_HOMEPAGE, isFF } from "../utils/feature-flags";
import { pages } from "@humansignal/app-common";

// 根路径 "/" 重定向到 "/projects" 作为首页
const HomeRedirect = () => <Redirect to="/projects" />;
HomeRedirect.path = "/";
HomeRedirect.exact = true;

export const Pages = [
  HomeRedirect,
  ProjectsPage,
  OrganizationPage,
  ModelsPage,
  pages.AccountSettingsPage,
].filter(Boolean);
