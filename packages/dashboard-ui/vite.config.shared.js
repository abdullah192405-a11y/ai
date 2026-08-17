import path from 'node:path';

/** Shared resolve aliases for admin and user dashboard apps. */
export function dashboardResolveAliases(dirname) {
  const dashboardUi = path.resolve(dirname, '../../packages/dashboard-ui');
  return [
    { find: '@wba/dashboard-ui/styles', replacement: path.join(dashboardUi, 'styles') },
    { find: '@wba/dashboard-ui', replacement: path.join(dashboardUi, 'src') },
    { find: '@wba/plans', replacement: path.resolve(dirname, '../../packages/plans') },
    { find: '@wba/widget-config', replacement: path.resolve(dirname, '../../packages/widget-config') },
  ];
}

/** Aliases for the marketing website app. */
export function websiteResolveAliases(dirname) {
  return [
    { find: '@wba/dashboard-ui', replacement: path.resolve(dirname, '../../packages/dashboard-ui/src') },
    { find: '@wba/plans', replacement: path.resolve(dirname, '../../packages/plans') },
    { find: '@wba/widget-config', replacement: path.resolve(dirname, '../../packages/widget-config') },
  ];
}
