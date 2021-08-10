module.exports = {
    apps: [
        {
            name: 'bot',
            script: './index.js',
            exec_mode: 'fork',
            error_file: './server/logs/pm2.err.log',
            out_file: './server/logs/pm2.out.log',
            node_args: ['--optimize_for_size', '--max_old_space_size=2048'],
            //node_args: ['--optimize_for_size', '--max_old_space_size=6144', '--gc_interval=100'],
            log_date_format: 'DD MMMM HH:mm:ss',
            env: {
                NODE_ENV: 'production',
            },
        }],
};
