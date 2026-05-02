#!/usr/bin/env node

const k8s = require('@kubernetes/client-node');
const chalk = require('chalk');
const Table = require('cli-table3');
const { program } = require('commander');

program
  .option('-n, --namespace <name>', 'Namespace to monitor', 'default')
  .option('-w, --watch', 'Enable watch mode (refresh every 5s)', false)
  .parse(process.argv);

const options = program.opts();

const kc = new k8s.KubeConfig();
try {
    kc.loadFromDefault();
} catch (e) {
    console.log(chalk.red('\n❌ Could not load KubeConfig. Ensure you have kubectl configured.'));
    process.exit(1);
}

const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

async function fetchPods() {
    try {
        const res = await k8sApi.listNamespacedPod(options.namespace);
        return res.body.items.map(p => ({
            name: p.metadata.name,
            status: p.status.phase,
            ip: p.status.podIP || 'N/A',
            restarts: p.status.containerStatuses ? p.status.containerStatuses[0].restartCount : 0,
            age: p.metadata.creationTimestamp
        }));
    } catch (err) {
        console.log(chalk.red(`\n❌ Error fetching pods: ${err.message}`));
        return [];
    }
}

async function render() {
    console.clear();
    console.log(chalk.cyan.bold(`\n☸️  K8s-Dash-Lite: Namespace [${options.namespace}]\n`));

    const pods = await fetchPods();

    const table = new Table({
        head: [chalk.bold('Pod Name'), chalk.bold('Status'), chalk.bold('Restarts'), chalk.bold('Pod IP')],
        colWidths: [40, 15, 10, 20]
    });

    pods.forEach(p => {
        let statusColor = chalk.white;
        if (p.status === 'Running') statusColor = chalk.green;
        if (p.status === 'Pending') statusColor = chalk.yellow;
        if (p.status === 'Failed' || p.status === 'CrashLoopBackOff') statusColor = chalk.red;

        table.push([
            p.name,
            statusColor(p.status),
            p.restarts > 5 ? chalk.red(p.restarts) : p.restarts,
            p.ip
        ]);
    });

    console.log(table.toString());

    if (options.watch) {
        console.log(chalk.dim('\nWatching... Press Ctrl+C to exit.'));
        setTimeout(render, 5000);
    } else {
        process.exit(0);
    }
}

render();
