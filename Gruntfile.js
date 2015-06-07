var handlebars = require('handlebars');
var _ = require('lodash');
var semver = require('semver');
var fs = require('fs');

/*global module:false*/
module.exports = function(grunt) {

  var DOWNLOAD_PREFIX = 'http://down.golaravel.com/laravel/';
  var tags;

  // Project configuration.
  grunt.initConfig({
    // Metadata.
    pkg: grunt.file.readJSON('package.json'),
    banner: '/*! <%= pkg.title || pkg.name %> - v<%= pkg.version %> - ' +
      '<%= grunt.template.today("yyyy-mm-dd") %>\n' +
      '<%= pkg.homepage ? "* " + pkg.homepage + "\\n" : "" %>' +
      '* Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author.name %>;' +
      ' Licensed <%= _.pluck(pkg.licenses, "type").join(", ") %> */\n',
    // Task configuration.
    exec: {
      composer_selfupdate: {
        cmd: 'composer selfupdate',
        stdout: false,
        stderr: false
      },
      git_clone: {
        cmd: 'git clone https://github.com/laravel/laravel --depth=1 --no-single-branch -q',
        stdout: false,
        stderr: false
      },
      git_tag_list: {
        cmd: 'git tag --list',
        cwd: './laravel',
        callback: function(err, stdout, stderr) {
          if(stderr.length > 0) {
            grunt.fail.fatal('git tag failed!');
          }

          tags = stdout.toString().trim().split('\n').filter(function(tag){
            if(/^v3/.test(tag)) {
              return false;
            } 

            return true;
          });

          tags = _.chain(tags).groupBy(function(ver){
            return [semver.major(ver), semver.minor(ver)].join('.');
          }).map(function(group){
            console.log(_.last(group));
            return _.last(group);
          }).value();

          tags.push('master');

          console.log(tags);
        },
        stdout: false,
        stderr: false
      },
      git_export_versions: {
        cmd: function() {
          var template = '{{#tags}}git archive --format=tar --prefix=laravel-{{this}}/ {{this}} | tar xf - && {{/tags}}';
          var cmd;

          template = handlebars.compile(template);
          cmd = template({tags: tags}).replace(/&&\s*$/g, '');

          console.log(cmd);
          return cmd;
        },
        cwd: 'laravel',
        stdout: false,
        stderr: false
      },
      composer: {
        cmd: function(){
          var cwd = process.cwd();
          // var template = '{{#tags}}(cd {{../cwd}}/{{this}} && composer install) && {{/tags}}';
          var template = '{{#tags}}(echo {{this}} && composer install -d laravel-{{this}}) && {{/tags}}';
          var cmd;

          template = handlebars.compile(template);
          cmd = template({tags: tags, cwd: cwd}).replace(/&&\s*$/g, '');

          console.log(cmd);
          return cmd;
        },
        cwd: 'laravel',
        stdout: false,
        stderr: false
      }
    },
    clean: ['laravel'],
    zip_directories: {
      versions: {
        files: [{
          filter: 'isDirectory',
          expand: true,
          cwd: './laravel',
          src: ['laravel-*'],
          dest: './laravel'
        }
        ]
      }
    },
    ftp_push: {
      upyun: {
        options: {
          host: 'v0.ftp.upyun.com',
          authKey: 'upyun',
          dest: '/'
        },
        files: [{
          expand: true,
          cwd: 'laravel',
          src: ['*.zip', 'laravel-*.js']
        }
        ]
      }
        
    },
    replace: {
      dist: {
        options: {
          patterns: [
            {
              match: /<html lang="en(-US)?">/ig,
              replacement: '<html lang="zh-CN">'
            },
            //v4
            {
              match: /@import url\(\/\/fonts.googleapis.com\/css\?family=.*\);/ig,
              replacement: ''
            },

            //v5
            {
              match: /<link href='\/\/fonts.googleapis.com\/css\?family=.*' rel='stylesheet' type='text\/css'>/ig,
              replacement: ''
            },
            {
              match: /<script src="https:\/\/oss.maxcdn.com\/html5shiv\/(\d\.\d\.\d)\/html5shiv.min.js"><\/script>/ig,
              replacement: '<script src="http://cdn.bootcss.com/html5shiv/$1/html5shiv.min.js"></script>'
            },
            {
              match: /<script src="https:\/\/oss.maxcdn.com\/respond\/(\d\.\d\.\d)\/respond.min.js"><\/script>/ig,
              replacement: '<script src="http://cdn.bootcss.com/respond.js/$1/respond.min.js"></script>'
            },
            {
              match: /\/\/cdnjs.cloudflare.com\/ajax\/libs/ig,
              replacement: 'http://cdn.bootcss.com'
            },
            {
              match: /twitter-bootstrap/ig,
              replacement: 'bootstrap'
            }
          ]
        },
        files: [
          {expand: true, cwd: 'laravel', src: ['laravel-*/resources/views/**/*.blade.php'], dest: 'laravel'},
          {expand: true, cwd: 'laravel', src: ['laravel-*/app/views/**/*.php'], dest: 'laravel'}
        ]
      }
    }
  });

  // These plugins provide necessary tasks.
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-zip-directories');
  grunt.loadNpmTasks('grunt-exec');
  grunt.loadNpmTasks('grunt-ftp-push-fullpath');
  grunt.loadNpmTasks('grunt-replace');

  // Default task.
  grunt.registerTask('default', [
    'clean', 
    'exec:composer_selfupdate',
    'exec:git_clone', 
    'exec:git_tag_list', 
    'exec:git_export_versions', 
    'replace',
    'exec:composer',
    'zip_directories', 
    'version_list',
    'ftp_push'
  ]);

  grunt.registerTask('test', ['exec:git_tag_list', 'version-list']);

  grunt.registerTask('version_list', 'save all laravel zips\' url to a json file', function(){
    var versions;

    versions = _.map(tags, function(tag){
      var states = fs.statSync('laravel/laravel-' + tag + '.zip');

      return {
        version: tag,
        download_url: DOWNLOAD_PREFIX + 'laravel-' +  tag + '.zip',
        size: states.size
      };
    });

    grunt.file.write('laravel/laravel-versions.js', 'listLaravelVersions(' + JSON.stringify(versions) + ');');
  });

};
