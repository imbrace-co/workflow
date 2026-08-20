const { composePlugins, withNx } = require('@nx/webpack');
const IgnoreDynamicRequire = require('webpack-ignore-dynamic-require');

module.exports = composePlugins(withNx(), (config) => {
  config.plugins.push(new IgnoreDynamicRequire());

  config.externals = {
    'isolated-vm': 'commonjs2 isolated-vm',
    'utf-8-validate': 'commonjs2 utf-8-validate',
    'bufferutil': 'commonjs2 bufferutil',
    
    // AWS SDK v3 modules - externalize to prevent webpack bundling issues
    '@aws-sdk/client-sts': 'commonjs2 @aws-sdk/client-sts',
    '@aws-sdk/credential-providers': 'commonjs2 @aws-sdk/credential-providers',
    '@aws-sdk/credential-provider-node': 'commonjs2 @aws-sdk/credential-provider-node',
    '@aws-sdk/credential-provider-env': 'commonjs2 @aws-sdk/credential-provider-env',
    '@aws-sdk/credential-provider-process': 'commonjs2 @aws-sdk/credential-provider-process',
    '@aws-sdk/credential-provider-ini': 'commonjs2 @aws-sdk/credential-provider-ini',
    '@aws-sdk/credential-provider-ec2': 'commonjs2 @aws-sdk/credential-provider-ec2',
    '@aws-sdk/credential-provider-container': 'commonjs2 @aws-sdk/credential-provider-container',
    '@aws-sdk/credential-provider-sso': 'commonjs2 @aws-sdk/credential-provider-sso',
    '@aws-sdk/credential-provider-web-identity': 'commonjs2 @aws-sdk/credential-provider-web-identity',
    '@aws-sdk/credential-provider-imds': 'commonjs2 @aws-sdk/credential-provider-imds',
    '@aws-sdk/credential-provider-cognito-identity': 'commonjs2 @aws-sdk/credential-provider-cognito-identity',
    '@aws-sdk/util-format-url': 'commonjs2 @aws-sdk/util-format-url',
    
    // Smithy property provider modules
    '@smithy/property-provider': 'commonjs2 @smithy/property-provider',
    '@smithy/shared-ini-file-loader': 'commonjs2 @smithy/shared-ini-file-loader',
    '@smithy/credential-provider-imds': 'commonjs2 @smithy/credential-provider-imds',
    
    // AWS MSK IAM SASL Signer - the specific module causing your issue
    'aws-msk-iam-sasl-signer-js': 'commonjs2 aws-msk-iam-sasl-signer-js',
    
    // Additional native modules that should not be bundled
    'fsevents': 'commonjs2 fsevents',
    'kerberos': 'commonjs2 kerberos',
    '@mongodb-js/zstd': 'commonjs2 @mongodb-js/zstd',
    'snappy': 'commonjs2 snappy',
    'mongodb-client-encryption': 'commonjs2 mongodb-client-encryption'
  };

  return config;
});
