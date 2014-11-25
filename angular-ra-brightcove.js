/*!
 * angular-ra-brightcove.js v0.0.1
 * https://github.com/red-ant/angular-ra-brightcove
 */
(function() {

  angular.module('ra.brightcove', [])
    .provider('raBrightcove', function() {
      var options = {};

      var getSetOptions = function(opts) {
        if (angular.isObject(opts)) {
          angular.extend(options, opts);
        } else {
          return options;
        }
      };

      this.options = getSetOptions;

      this.$get = function() {
        return {
          options: getSetOptions
        };
      };
    })

    .directive('brightcove', function($window, $timeout, $interpolate, raBrightcove) {

      // Get player options
      var player_options = raBrightcove.options();

      // Check options have been set
      if (!player_options.player_id ||
          !player_options.player_key) {
        throw new Error('You need to set a player_id and player_key with the raBrightcoveProvider');
      }

      // For Brightcove Smart Player API callback
      $window.BCL = {
        onBrightcoveTemplateLoaded: function(experience_id) {
          var scope = $('[data-player-id=' + experience_id + ']').scope();

          if (scope) {
            scope.$apply(function() {
              scope.brightcove_api.setPlayer();
            });
          }
        },

        onBrightcoveTemplateReady: function(event) {
          var scope = $('[data-player-id=' + event.target.experience.id + ']').scope();

          if (scope) {
            scope.$apply(function() {
              // set template ready
              scope.template_ready = true;
            });
          }
        }
      };

      return {
        restrict:      'EA',
        transclude:    true,
        templateUrl:   '/assets/brightcove/_brightcove.html',
        scope: {
          id:             '=?',
          category:       '@',
          scheduled:      '@',
          playlist_id:    '=playlistId',
          playlist_data:  '=playlistData',
          video_still:    '@videoStill',
          auto_start:     '@autoStart'
        },

        controller: function($scope) {
          this.play = function() {
            $scope.$broadcast('raBrightcove:play');
          };

          this.setVideoId = function(id, play) {
            var is_changed = $scope.current_id !== id;

            if (is_changed) {
              $scope.current_id = id;
              $scope.$broadcast('raBrightcove:change');
            }

            if (play) {
              this.play();
            }
          };

          this.setVideoStill = function(video_still) {
            $scope.current_video_still = video_still;
          };

          this.setVideoTemplateReady = function(video_template_ready) {
            $scope.video_template_ready = video_template_ready;
          };

          this.setType = function(type) {
            var acceptable_types = ['video', 'playlist', 'video-still'];

            if (_.contains(acceptable_types, type)) {
              $scope.type = type;
            } else {
              $scope.type = acceptable_types[0];
            }
          };

          this.reinitAPI = function() {
            $scope.template_ready = false;
            $scope.brightcove_api.init();
          };
        },

        link: function(scope, element, attrs, controller) {
          //---------------------------------
          // Brightcove API
          scope.brightcove_api = {
            id:          undefined,
            player:      undefined,
            player_type: undefined,
            modules:     {},

            init: function(id) {
              if (angular.isDefined(id)) {
                this.id = id;
              }

              if (this.id && scope.video_template_ready === true) {
                // Insert HTML in the next digest cycle
                // And call brightcove.createExperiences after another timeout to
                // ensure Brightcove API is initialised when Brightcove Object tag is inserted in DOM and visible
                $timeout(this.setHTML.bind(this))
                  .then(this.createExperiences.bind(this, 300));
              }
            },

            setHTML: function() {
              // if player has no video id - it is a placeholder player used to retrieve Brightcove playlist
              if (scope.current_id && this.player_type === 'video' ||
                  !scope.current_id && this.player_type === 'api') {
                return;
              } else {
                this.player_type = scope.current_id ? 'video' : 'api';
              }

              // KLUDGE: for some reason, in IE8, when appending an object tag to DOM, param tags are not getting appended
              // Therefore, we cannot use ng-if or ng-switch to insert object tags conditionally
              var html_object = element.find('.BrightcoveExperience').get(0);
              var html = '<object id="myExperience{{ brightcove_api.id }}" class="BrightcoveExperience">' +
                           '<param name="bgcolor" value="#FFFFFF">' +
                           '<param name="width" value="100%">' +
                           '<param name="height" value="100%">' +
                           '<param name="playerID" value="'+ player_options.player_id +'" />' +
                           '<param name="playerKey" value="'+ player_options.player_key +'" />' +
                           '<param name="isVid" value="true">' +
                           '<param name="isUI" value="true">' +
                           '<param name="dynamicStreaming" value="true">' +
                           '<param name="htmlFallback" value="true">' +
                           '<param name="wmode" value="opaque">' +
                           '<param name="autoStart" value="{{ auto_start || false }}">' +
                           '<param name="includeAPI" value="true">' +
                           '<param name="secureConnections" value="{{ ssl }}">' +
                           '<param name="secureHTMLConnections" value="{{ ssl }}" />' +
                           '<param name="videoSmoothing" value="false" />' +
                           '<param name="templateLoadHandler" value="BCL.onBrightcoveTemplateLoaded">' +
                           '<param name="templateReadyHandler" value="BCL.onBrightcoveTemplateReady">';

              if (this.player_type === 'video') {
                html += '<param name="@videoPlayer" value="{{ current_id }}">';
              }

              html += '</object>';

              if (html_object) {
                html_object.outerHTML = $interpolate(html)(scope);
              }
            },

            setPlayer: function() {
              scope.brightcove_api.player = $window.brightcove.api.getExperience('myExperience' + this.id);
            },

            setModules: function() {
              if (angular.isDefined(scope.brightcove_api.player)) {
                // assign brightcove player modules for later use
                scope.brightcove_api.modules.experience   = scope.brightcove_api.player.getModule($window.brightcove.api.modules.APIModules.EXPERIENCE);
                scope.brightcove_api.modules.video_player = scope.brightcove_api.player.getModule($window.brightcove.api.modules.APIModules.VIDEO_PLAYER);
                scope.brightcove_api.modules.cue_points   = scope.brightcove_api.player.getModule($window.brightcove.api.modules.APIModules.CUE_POINTS);
                scope.brightcove_api.modules.content      = scope.brightcove_api.player.getModule($window.brightcove.api.modules.APIModules.CONTENT);
              }
            },

            createExperiences: function(timeout) {
              $window.brightcove = $window.brightcove || { createExperiences: angular.noop };
              return _.debounce($window.brightcove.createExperiences, timeout || 0)();
            },

            isSSL: function() {
              return $window.location.protocol === 'https:';
            }
          };

          //---------------------------------
          // Dimension
          scope.dimension = {
            width:       0,
            height:      0,
            window_size: undefined,

            update: function() {
              var player    = element.find('[brightcove-video]'),
                  container = player.parents('.brightcove-video-container'),
                  ratio,
                  width,
                  height,
                  originalWidth;

              if (!container.get(0)) {
                container = element.parent();
              }

              originalWidth = container.css('width');
              ratio         = container.css({ width: 'auto' }).width() / 16;
              width         = Math.floor(ratio) * 16;
              height        = Math.floor(ratio) * 9;

              if (width > 0 && height > 0 && this.width !== width && this.height !== height) {
                this.height = height;
                this.width  = width;

                // Set container dimension
                container.css({ width: width });

                // Set Brightcove video size using its smart player API
                if (scope.brightcove_api.modules.experience && scope.brightcove_api.modules.experience.setSize) {
                  scope.brightcove_api.modules.experience.setSize(this.width, this.height);
                }
              } else {
                // Reset to original width
                container.css({ width: originalWidth });
              }
            },

            onResize: function() {
              this.update();
            },

            autoResize: function() {
              var _this = this;

              // Listen to window resize event
              if (!_this.window_size) {
                _this.window_size = {};

                $($window).resize(_.debounce(function() {
                  var new_size = {
                                   width:  $(window).width(),
                                   height: $(window).height()
                                 };

                  if (_this.window_size.width  !== new_size.width ||
                      _this.window_size.height !== new_size.height) {
                    scope.$apply(function() {
                      _this.onResize.apply(_this, arguments);
                    });
                  }

                  _this.window_size.width  = new_size.width;
                  _this.window_size.height = new_size.height;
                }, 300));
              }
            },

            init: function() {
              // Listen to Angular events
              scope.$on('raBrightcove:resize', this.onResize.bind(this));
              scope.$on('tab:change',          this.onResize.bind(this));

              // Auto resize
              this.autoResize();

              // Initial update
              $timeout(this.update.bind(this), 300);
            }
          };

          //---------------------------------
          // Watchers
          scope.listeners = {
            template_ready: function(template_ready) {
              if (template_ready) {
                scope.brightcove_api.setModules();

                scope.dimension.update();
                scope.$broadcast('raBrightcove:templateReady');
              }
            },

            video_still: function(video_still) {
              if (video_still) {
                controller.setVideoStill(video_still);
                scope.dimension.update();
              }
            },

            id: function(id) {
              if (angular.isDefined(id)) {
                // attempt to load brightcove
                controller.setVideoId(id);
                scope.brightcove_api.init(id);
              }
            },

            playlist_id: function(id) {
              if (angular.isDefined(id)) {
                // attempt to load brightcove
                scope.brightcove_api.init(id);
              }
            },

            video_template_ready: function(video_template_ready) {
              if (video_template_ready) {
                // attempt to load brightcove
                scope.brightcove_api.init(scope.brightcove_api.id);
              }
            }
          };

          //---------------------------------
          // Constructor
          scope.init = function() {
            // Vars
            scope.ssl = scope.brightcove_api.isSSL();

            // Calls
            controller.setType(attrs.type || (angular.isDefined(attrs.playlistId) ? 'playlist' : 'video'));
            scope.dimension.init();

            // Watchers
            scope.$watch('template_ready', scope.listeners.template_ready);
            scope.$watch('video_still', scope.listeners.video_still);
            scope.$watch('video_template_ready', scope.listeners.video_template_ready);

            if (angular.isDefined(attrs.id)) {
              scope.$watch('id', scope.listeners.id);
            } else {
              scope.$watch('playlist_id', scope.listeners.playlist_id);
            }
          };

          //---------------------------------
          // Init
          scope.init();
        }
      };
    }).

    directive('brightcovePlaylist', function($window, $timeout) {
      return {
        restrict:     'EA',
        require:      '^brightcove',
        templateUrl:  '/assets/brightcove/_playlist.html',
        scope:        true,

        link: function(scope, element, attrs, controller) {
          scope.playlist = {
            element:  element.find('.brightcove-playlist'),
            width:    undefined,
            height:   undefined,
            data:     undefined,
            expanded: false,

            expand_button: {
              height: 35,
              visible: false,

              toggle: function(expanded) {
                if (angular.isUndefined(expanded)) {
                  scope.playlist.expanded = !scope.playlist.expanded;
                } else {
                  scope.playlist.expanded = expanded;
                }

                // KLUDGE: force browser to repaint/reflow DOM
                $timeout(function() {
                  scope.playlist.element.hide();
                  scope.playlist.element.offset();
                  scope.playlist.element.show();
                });
              }
            },

            get: function() {
              scope.$watch('playlist_data', this.set.bind(this));
            },

            set: function() {
                this.data = scope.playlist_data;
                this.cue();
                this.updateDimension();
            },

            updateDimension: function() {
              if (scope.dimension && this.data) {
                $timeout(this.updateDimensionWithData.bind(this));
              } else if (scope.dimension && !this.data) {
                this.height = scope.dimension.height;
                this.expand_button.visible = false;
              }
            },

            updateDimensionWithData: function() {
              var height     = scope.dimension.height,
                  last_child = _.last(this.data.items);

              // set height
              if (!this.isChildVisible(last_child.id)) {
                this.height = height - this.expand_button.height;
                this.expand_button.visible = true;
              } else {
                this.height = height;
                this.expand_button.visible = false;
              }
            },

            cue: function() {
              var _this       = this,
                  playlist    = this.data,
                  first_video = playlist.items[0];

              // Set initial video
              if (first_video && !scope.id) {
                controller.setVideoId(first_video.id);
                controller.setVideoStill(first_video.videoStillURL);
                controller.reinitAPI();
              }

              // Play next video
              scope.brightcove_api.modules.video_player.addEventListener($window.brightcove.api.events.MediaEvent.COMPLETE, function() {
                var video            = _.find(playlist.items, { id: scope.current_id }),
                    video_index      = _.indexOf(playlist.items, video),
                    next_video_index = video_index + 1,
                    next_video       = playlist.items[next_video_index];

                if (next_video_index < playlist.items.length) {
                  scope.$apply(function() {
                    controller.setVideoId(next_video.id, true);
                    controller.setVideoStill(next_video.videoStillURL);

                    // Scroll playlist so that next video is in focus
                    if (!_this.isChildVisible(next_video.id)) {
                      _this.scrollTo(next_video.id, -30);
                    }
                  });
                }
              });
            },

            scrollTo: function(id, offset) {
              var position = this.getChild(id).position();

              if (position && position.top) {
                this.element.animate({
                  scrollTop: '+=' + (position.top + offset)
                });
              }
            },

            isChildVisible: function(id) {
              var child    = this.getChild(id),
                  position = child.position(),
                  height   = scope.dimension.height || this.element.height();

              if (position && angular.isDefined(position.top)) {
                return position.top >= 0 && position.top <= height - child.innerHeight();
              }
            },

            getChild: function(id) {
              return this.element.find('[data-id=' + id + ']').eq(0);
            },

            play: function(id) {
              controller.setVideoId(id, true);
            },

            init: function() {
              this.element.css({ position: 'relative' });
              this.get();
            }
          };

          scope.init = function() {
            // Listeners
            scope.$on('raBrightcove:templateReady', function() {
              scope.playlist.init();
            });

            scope.$watch('dimension.height', function() {
              scope.playlist.updateDimension();
            });
          };

          scope.init();
        }
      };
    }).

    directive('brightcoveVideo', function($window, $location, $timeout, $rootScope) {
      return {
        restrict:     'EA',
        require:      '^brightcove',
        templateUrl:  '/assets/brightcove/_video.html',
        scope:        true,

        link: function(scope, element, attrs, controller) {
          //---------------------------------
          // Video
          scope.video = {
            is_playing:        false,
            is_played:         false,
            started_playing:   false,
            completed_playing: false,
            position:          undefined,
            duration:          undefined,
            rendition:         undefined,
            timeout_count:     0,

            play: function(id) {
              if (angular.isUndefined(scope.brightcove_api.modules.video_player) || !scope.current_id) {
                // Try again if API module is not ready
                if (this.timeout_count < 10) {
                  $timeout(function() {
                    this.play(id);
                    this.timeout_count++;
                  }.bind(this), 500);
                }
              } else {
                // Show video player
                element.show();

                // Set flags
                this.is_playing      = true;
                this.is_played       = true;
                this.started_playing = true;

                // Alert
                scope.alerts.init();

                // Increment the video counter
                Video.increment.show({ id: id || scope.current_id });

                // Play (by id or current video)
                if (angular.isDefined(id)) {
                  scope.brightcove_api.modules.video_player.loadVideoByID(id);
                } else {
                  scope.brightcove_api.modules.video_player.loadVideoByID(scope.current_id);
                }
              }
            },

            get: function() {
              var _this = this;

              // get current video still
              scope.brightcove_api.modules.video_player.getCurrentVideo(function(video) {
                scope.$apply(function() {
                  _this.set(video);
                });
              });
            },

            reset: function() {
              this.is_playing         = false;
              this.is_played          = false;
              this.started_playing    = false;
              this.completed_playing  = false;
              this.position           = undefined;
              this.duration           = undefined;
              this.timeout_count      = 0;
            },

            set: function(video) {
              if (angular.isObject(video)) {
                this.data = video;

                // If video_still is not set already, set it using data from brightcove
                if (!scope.video_still || scope.video_still.match('missing')) {
                  controller.setVideoStill(video.videoStillURL);
                }
              }
            },

            listenAPI: function() {
              if (!scope.brightcove_api.modules.video_player) {
                return;
              }

              var _this = this;

              // Keep track of video status
              scope.brightcove_api.modules.video_player.addEventListener($window.brightcove.api.events.MediaEvent.STOP, function() {
                scope.$apply(function() {
                  scope.video.is_playing = false;
                });
              });

              // Keep track of video status
              scope.brightcove_api.modules.video_player.addEventListener($window.brightcove.api.events.MediaEvent.PLAY, function() {
                scope.$apply(function() {
                  scope.video.is_playing = true;
                });
              });

              // On complete
              scope.brightcove_api.modules.video_player.addEventListener($window.brightcove.api.events.MediaEvent.COMPLETE, function() {
                scope.$apply(function() {
                  scope.video.completed_playing = true;
                });
              });

              // On progress, store progress
              scope.brightcove_api.modules.video_player.addEventListener($window.brightcove.api.events.MediaEvent.PROGRESS, function(event) {
                scope.$apply(function() {
                  scope.video.position  = event.position;
                  scope.video.rendition = event.rendition;
                });
              });

              // Store the duration of the video
              scope.brightcove_api.modules.video_player.getVideoDuration(false, function(duration) {
                scope.$apply(function() {
                  scope.video.duration = duration;
                });
              });

              // On media change
              scope.brightcove_api.modules.video_player.addEventListener($window.brightcove.api.events.MediaEvent.CHANGE, function() {
                scope.$apply(function() {
                  _this.get();
                });
              });
            },

            listen: function() {
              var _this = this;

              scope.$on('raBrightcove:play', function() {
                _this.play(scope.current_id);
              });

              scope.$on('raBrightcove:change', function() {
                _this.reset();
              });
            },

            init: function() {
              this.listen();
              this.listenAPI();
            }
          };

          scope.alerts = {
            rendition: undefined,

            Alert: (function() {
              function Alert(type) {
                this.type    = type;
                this.visible = false;
                this.storage = raStorage('brightcove_alert_' + type);

                this.init();
              }

              Alert.prototype = {
                init: function() {
                  if (this.type === 'rendition') {
                    if (!this.storage.get('closed') &&
                        scope.video.is_played &&
                        scope.brightcove_api.player.type === 'flash') {
                      this.visible = true;
                    }
                  }
                },

                show: function() {
                  this.visible = true;
                },

                close: function(remember) {
                  this.visible = false;

                  if (remember) {
                    this.storage.set('closed', true);
                  }
                }
              };

              return Alert;
            })(),

            create: function(type) {
              return new this.Alert(type);
            },

            init: function() {
              this.rendition = this.create('rendition');
            }
          };


          //---------------------------------
          // Constructor
          scope.init = function() {
            controller.setVideoTemplateReady(true);
            scope.video.init();

            // Listeners
            scope.$on('raBrightcove:templateReady', function() {
              scope.video.get();
            });
          };

          scope.init();
        }
      };
    }).

    directive('brightcoveVideoStill', function() {
      return {
        require:      '^brightcove',
        templateUrl:  '/assets/brightcove/_video-still.html',
        link: function(scope, element, attrs, controller) {
          scope.video_still = {
            get: function() {
              // get current video still
              scope.brightcove_api.modules.video_player.getCurrentVideo(function(video) {
                scope.$apply(function() {
                  controller.setVideoStill(video.videoStillURL);
                });
              });
            },

            init: function() {
              this.get();
            }
          };

          scope.init = function() {
            controller.setVideoTemplateReady(true);

            // Listeners
            scope.$on('raBrightcove:templateReady', function() {
              scope.video_still.init();
            });
          };

          scope.init();
        }
      };
    }).

    directive('videoDimensions', function($timeout) {
      function setDimensions(element) {
        $timeout(function() {
          element.height(Math.round(element.width() * 9/16));

          // reload iframe after dimension is set
          reloadIframe(element);
        });
      }

      function reloadIframe(element) {
        if (element.prop('tagName').toLowerCase() === 'iframe') {
          if (angular.isDefined(element.attr('src'))) {
            element.attr({ src: element.attr('src') });
          }
        }
      }

      return {
        restrict: 'A',
        link: function(scope, element, attrs) {
          if (angular.isDefined(attrs.videoDimensionsWatch)) {
            scope.$watch(attrs.videoDimensionsWatch, function(value) {
              if (angular.isDefined(value)) {
                setDimensions(element);
              }
            });
          } else {
            setDimensions(element);
          }
        }
      };
    }).

    directive('cuepoints', function($window, $timeout) {
      return {
        restrict: 'EA',
        replace: true,
        require: '^brightcove',
        templateUrl: '/assets/brightcove/_cuepoints.html',
        link: function($scope, element, attrs, controller) {
          var player,
              player_module;

          //---------------------------------
          // Watcher
          $scope.templateReadyWatch = function(template_ready) {
            if (template_ready) {
              player        = $scope.brightcove_api.player;
              player_module = $scope.brightcove_api.modules.video_player;

              if (player_module && $('#myExperience' + $scope.brightcove_api.id).get(0)) {
                var events = {
                  progress: 'progress', play: 'play', stop: 'stop', seek: 'seek_notify'
                };

                _.each(events, function(val, key) {
                  player_module.addEventListener($window.brightcove.api.events.MediaEvent[val.toUpperCase()], function(event) {
                    key = key.charAt(0).toUpperCase() + key.slice(1);
                    key = 'onVideo' + key;

                    if (angular.isFunction($scope[key])) {
                      $timeout(function() { $scope[key](event); });
                    }
                  });
                });

                player_module.addEventListener($window.brightcove.api.events.CuePointEvent.CUE, function(event) {
                  $timeout(function() { $scope.onVideoCuePoint(event); });
                });

                player_module.getVideoDuration(false, function(duration) {
                  $timeout(function() { $scope.duration = duration; });
                });

                $scope.getCuePoints();
                $scope.templateReadyWatcher();
              }
            }
          };

          //---------------------------------
          // Seek
          $scope.seek = function() {
            var chapter = this.chapter;
            player_module.getIsPlaying(function(is_playing) {
              if (is_playing === true) {
                player_module.seek(chapter.time);
                $scope.time = chapter.time;
                $scope.startTimer(chapter.time);
                $scope.updateChapters(chapter.time);
              } else {
                // Queue a time, and listen for video progress
                $scope.queued_time = chapter.time;
                $scope.time        = chapter.time;
                player_module.addEventListener($window.brightcove.api.events.MediaEvent.PROGRESS, queuedPlayback);

                // Play the video
                controller.play();
              }
            });
          };

          //---------------------------------
          // Video Events
          $scope.onVideoProgress = function() {
          };

          $scope.onVideoPlay = function(event) {
            if (event) {
              $scope.time = event.position;
              $scope.updateChapters(event.position);
              $scope.startTimer(event.position);
            }
          };

          $scope.onVideoStop = function() {
            $scope.stopTimer();
          };

          $scope.onVideoSeek = function(event) {
            if (event) {
              $scope.time = event.position;
              $scope.updateChapters(event.position);
              $scope.updateProgress(event.position);
            }
          };

          $scope.onVideoCuePoint = function(event) {
            if (event) {
              $scope.time = event.cuePoint.time;
              $scope.updateChapters(event.cuePoint.time);
              $scope.$emit('raBrightcove:cuepoint', event.cuePoint);
            }
          };

          //---------------------------------
          // Progress Timer
          $scope.clearTimer = function() {
            if ($scope.timer) {
              $timeout.cancel($scope.timer);
            }
          };

          $scope.startTimer = function() {
            $scope.clearTimer();

            $scope.timer = $timeout(function() {
              $scope.time = $scope.time + 0.5;
              $scope.updateProgress();
              $scope.startTimer();
            }, 500);
          };

          $scope.stopTimer = function() {
            $scope.clearTimer();
          };

          //---------------------------------
          // Chapters
          $scope.updateProgress = function() {
            var current_chapter = $scope.chapters[$scope.current_chapter];

            if (current_chapter) {
              var width = Math.round(100 * 100 * ($scope.time - current_chapter.time) / current_chapter.length) / 100;

              $scope.chapters[$scope.current_chapter].progress_width = width;
            }
          };

          $scope.updateChapters = function(time) {
            var set = false;
            _.each($scope.chapters, function(chapter, index) {
              if (time < chapter.end_time) {
                if (set === false) {
                  set = true;
                  $scope.current_chapter = index;
                  chapter.active = true;
                } else {
                  chapter.active = false;
                  chapter.progress_width = 0;
                }
                chapter.past = false;
              } else {
                chapter.active = false;
                chapter.past   = true;
                chapter.progress_width = 100;
              }
            });
          };

          $scope.populateChapters = function() {
            var duration = $scope.duration;

            // Determine chapter length
            _.each($scope.cuepoints, function(chapter, index) {
              var next_chapter = $scope.cuepoints[index + 1];

              if (next_chapter) {
                chapter.length   = next_chapter.time - chapter.time;
                chapter.end_time = next_chapter.time;
              } else {
                chapter.length   = duration - chapter.time;
                chapter.end_time = duration;
              }
            });

            // Only create chapters for cuepoints that are not ads, pre-roll or post-roll
            $scope.chapters = _.filter($scope.cuepoints, function(cuepoint) {
              if (cuepoint.type === 1 &&
                  cuepoint.name !== 'Pre-roll' &&
                  cuepoint.name !== 'Post-roll') {
                return true;
              } else {
                duration -= cuepoint.length;

                return false;
              }
            });

            // Draw chapters
            _.each($scope.chapters, function(chapter) {
              chapter.width = (100 * 100 * chapter.length / duration) / 100;

              var minutes = Math.floor(chapter.length / 60),
                  seconds = Math.round(chapter.length % 60);

              chapter.duration = minutes + ':' + seconds;
              chapter.content  = '<p><b>'+ chapter.name +'</b></p>';
              chapter.content += '<p>Duration: '+ chapter.duration +'</p>';

              if (chapter.metadata) {
                chapter.content += '<p>'+ chapter.metadata +'</p>';
              }
            });
          };

          //---------------------------------
          // Cuepoints
          $scope.getCuePoints = function() {
            $scope.brightcove_api.modules.cue_points.getCuePoints($scope.current_id, function(cuepoints) {
              $timeout(function() {
                $scope.getCuePointsSuccess(cuepoints);
              });
            });
          };

          $scope.getCuePointsSuccess = function(cuepoints) {
            $scope.cuepoints = cuepoints;
            $scope.populateChapters();
            $scope.$emit('raBrightcove:cuepointsLoaded', $scope.current_id, cuepoints);
          };

          //---------------------------------
          // Constructor
          $scope.init = function() {
            $scope.templateReadyWatcher = $scope.$watch('template_ready', $scope.templateReadyWatch);
          };

          $scope.init();

          // Private methods
          function queuedPlayback() {
            player_module.removeEventListener($window.brightcove.api.events.MediaEvent.PROGRESS, queuedPlayback);
            player_module.seek($scope.queued_time);
          }
        }
      };
    });

})();
