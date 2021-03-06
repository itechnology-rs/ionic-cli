import { CommandGroup, OptionGroup, ParsedArgs, unparseArgs } from '@ionic/cli-framework';
import chalk from 'chalk';

import { AngularBuildOptions, CommandLineInputs, CommandLineOptions, CommandMetadata } from '../../../definitions';
import { BUILD_SCRIPT, BuildCLI, BuildRunner, BuildRunnerDeps } from '../../build';

import { AngularProject } from './';

const NG_BUILD_OPTIONS = [
  {
    name: 'configuration',
    aliases: ['c'],
    summary: 'Specify the configuration to use.',
    type: String,
    groups: [OptionGroup.Advanced],
    hint: chalk.dim('[ng]'),
  },
];

export interface AngularBuildRunnerDeps extends BuildRunnerDeps {
  readonly project: AngularProject;
}

export class AngularBuildRunner extends BuildRunner<AngularBuildOptions> {
  constructor(protected readonly e: AngularBuildRunnerDeps) {
    super();
  }

  async getCommandMetadata(): Promise<Partial<CommandMetadata>> {
    return {
      groups: [CommandGroup.Beta],
      description: `
${chalk.green('ionic build')} uses the Angular CLI. Use ${chalk.green('ng build --help')} to list all Angular CLI options for building your app. See the ${chalk.green('ng build')} docs${chalk.cyan('[1]')} for explanations. Options not listed below are considered advanced and can be passed to the ${chalk.green('ng')} CLI using the ${chalk.green('--')} separator after the Ionic CLI arguments. See the examples.

${chalk.cyan('[1]')}: ${chalk.bold('https://github.com/angular/angular-cli/wiki/build')}`,
      options: [
        {
          name: 'prod',
          summary: `Flag to set configuration to ${chalk.bold('production')}`,
          type: Boolean,
          hint: chalk.dim('[ng]'),
        },
        {
          name: 'source-map',
          summary: 'Output sourcemaps',
          type: Boolean,
          groups: [OptionGroup.Advanced],
          hint: chalk.dim('[ng]'),
        },
        ...NG_BUILD_OPTIONS,
      ],
      exampleCommands: [
        '--prod',
      ],
    };
  }

  createOptionsFromCommandLine(inputs: CommandLineInputs, options: CommandLineOptions): AngularBuildOptions {
    const baseOptions = super.createBaseOptionsFromCommandLine(inputs, options);
    const prod = options['prod'] ? Boolean(options['prod']) : undefined;
    const configuration = options['configuration'] ? String(options['configuration']) : (prod ? 'production' : undefined);
    const sourcemaps = typeof options['source-map'] === 'boolean' ? Boolean(options['source-map']) : undefined;

    return {
      ...baseOptions,
      configuration,
      sourcemaps,
      type: 'angular',
    };
  }

  async buildProject(options: AngularBuildOptions): Promise<void> {
    const ng = new AngularBuildCLI(this.e);
    await ng.build(options);
  }
}

class AngularBuildCLI extends BuildCLI<AngularBuildOptions> {
  readonly name = 'Angular CLI';
  readonly pkg = '@angular/cli';
  readonly program = 'ng';
  readonly prefix = 'ng';
  readonly script = BUILD_SCRIPT;

  protected async buildArgs(options: AngularBuildOptions): Promise<string[]> {
    const { pkgManagerArgs } = await import('../../utils/npm');

    const args = await this.buildOptionsToNgArgs(options);

    if (this.resolvedProgram === this.program) {
      return [...this.buildArchitectCommand(options), ...args];
    } else {
      const [ , ...pkgArgs ] = await pkgManagerArgs(this.e.config.get('npmClient'), { command: 'run', script: this.script, scriptArgs: [...args] });
      return pkgArgs;
    }
  }

  protected async buildOptionsToNgArgs(options: AngularBuildOptions): Promise<string[]> {
    const args: ParsedArgs = {
      _: [],
      'source-map': options.sourcemaps !== false ? options.sourcemaps : 'false',
    };

    if (options.engine === 'cordova') {
      const integration = await this.e.project.getIntegration('cordova');
      args.platform = options.platform;

      if (this.e.project.directory !== integration.root) {
        args.cordovaBasePath = integration.root;
      }
    }

    return [...unparseArgs(args), ...options['--']];
  }

  protected buildArchitectCommand(options: AngularBuildOptions): string[] {
    const cmd = options.engine === 'cordova' ? 'ionic-cordova-build' : 'build';
    const project = options.project ? options.project : 'app';

    return ['run', `${project}:${cmd}${options.configuration ? `:${options.configuration}` : ''}`];
  }
}
