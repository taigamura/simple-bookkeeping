const app = require('./app.json').expo;

// The Watch target is a development scaffold until it has passed the physical
// device certification gate. Keep production builds free of its embedded app.
module.exports = () => {
  const watchExpenseEnabled = process.env.KAJI_ENABLE_WATCH_EXPENSE === '1';
  return {
    ...app,
    plugins: app.plugins.filter((plugin) => plugin !== './config/withWatchExpense')
      .concat(watchExpenseEnabled ? ['./config/withWatchExpense'] : []),
    extra: {
      ...app.extra,
      watchExpenseEnabled,
    },
  };
};
