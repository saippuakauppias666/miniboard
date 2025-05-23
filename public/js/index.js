export * from './polyfill';
import utils from './utils';
import storage from './storage';
import ui_window from './ui_window';
import gallery from './gallery';

// ruffle player
window.RufflePlayer = window.RufflePlayer || {};
window.RufflePlayer.config = {
  // Options affecting the whole page
  'publicPath': undefined,
  'polyfills': false,

  // Options affecting files only
  'autoplay': 'on',
  'unmuteOverlay': 'visible',
  'backgroundColor': null,
  'wmode': 'window',
  'letterbox': 'fullscreen',
  'warnOnUnsupportedContent': false,
  'contextMenu': true,
  'showSwfDownload': false,
  'upgradeToHttps': false,
  'maxExecutionDuration': {'secs': 15, 'nanos': 0},
  'logLevel': 'error',
  'base': null,
  'menu': true,
  'salign': '',
  'scale': 'showAll',
  'quality': 'high',
  'preloader': true,
};

// chiptune2.js player
window.libopenmpt = {};

// app constants
const FILE_EXTS_IMAGE = [
  'png',
  'jpg',
  'jpeg',
  'bmp',
  'gif',
  'webp',
];
const FILE_EXTS_VIDEO = [
  'mp4',
  'webm',
];
const FILE_EXTS_AUDIO = [
  'mp3',
  'wav',
  'ogg',
  'oga',
  'opus',
  'flac',
];
// app state
var state = {
  mouse_over_post_ref_link: false,
  post_preview_cache: {},
  menubar_detach: true,
  thread_quickreply: true,
  thread_auto_update: {
    enabled: true,
    interval: null,
    post_id_after: 0,
  },
  audio_loop: false,
  video_loop: false,
  audio_autoclose: true,
  video_autoclose: true,
  audio_volume: 0.2,
  video_volume: 0.2,
  swf_volume: 0.2,
  mod_stereo: 1.0,
  chiptune2js: {
    player: null,
    interval: null,
  },
};

/**
 * Tegaki event: Finish drawing image.
 */
function tegaki_on_done() {
  console.log('tegaki: saving...');
  
  window.Tegaki.flatten().toBlob((blob) => {
    const input_file = new File([blob], 'drawing.png');
    const input_data = new DataTransfer();
    input_data.items.add(input_file);

    const postform_file = select_postform_element('form-file');
    console.log(postform_file.files);
    postform_file.files = input_data.files;
  }, 'image/png');
}

/**
 * Tegaki event: Cancel drawing image.
 */
function tegaki_on_cancel() {
  console.log('tegaki: cancelling...');
}

/**
 * Utility function, get file info from a post/reply element.
 * @param {*} element 
 * @returns 
 */
function get_finfo(element) {
  if (element == null) {
    return null;
  }

  let file_info = element.getElementsByClassName('file-info');
  file_info = file_info != null && file_info.length > 0 ? file_info[0] : null;
  let file_data = element.getElementsByClassName('file-data');
  file_data = file_data != null && file_data.length > 0 ? file_data[0].innerHTML : null;
  file_data = file_data != null && file_data.length > 0 ? file_data : null;
  let file_href = element.getElementsByClassName('file-thumb-href');
  file_href = file_href != null && file_href.length > 0 ? file_href[0].href : '';
  let file_ext = file_data == null ? file_href.split('.').pop().toLowerCase() : 'embed';

  return {
    file_info,
    file_data,
    file_href,
    file_ext,
  };
}

/**
 * Event listener: click on post thumbnail anchor.
 * Expands/shrinks the content.
 * @param {*} event 
 */
function listener_post_thumb_link_click(event) {
  event.preventDefault();
  event.stopPropagation();

  let event_target = event.target;
  let event_current = event.currentTarget;

  if (event_target.tagName !== 'IMG') {
    return;
  }

  const shrink = function(target, current) {
    const finfo = get_finfo(current.parentElement.parentElement);

    current.firstElementChild.style.display = null;

    switch (finfo.file_ext) {
      case 'mp4':
      case 'webm':
        current.parentElement.lastElementChild.remove();
        break;
      case 'mp3':
      case 'wav':
      case 'ogg':
      case 'oga':
      case 'opus':
      case 'flac':
        target.style.minWidth = null;
        current.parentElement.lastElementChild.remove();
        break;
      case 'mod':
      case 'xm':
      case 'it':
      case 's3m':
      case 'med':
        if (state.chiptune2js.player != null) {
          clearInterval(state.chiptune2js.interval);
          state.chiptune2js.player.stop();
        }

        current.lastElementChild.remove();
        break;
      default:
        target.remove();
        break;
    }

    const file_shrink = finfo.file_info.getElementsByClassName('file-shrink-href');
    if (file_shrink.length > 0) {
      file_shrink[0].remove();
    }

    current.setAttribute('expanded', 'false');
  };

  const expand = function(target, current) {
    const finfo = get_finfo(current.parentElement.parentElement);
    
    // expand the selected element
    switch (finfo.file_ext) {
      case 'mp4':
      case 'webm':
        target.style.display = 'none';
        
        let source = document.createElement('source');
        source.src = finfo.file_href;
        let video = document.createElement('video');
        video.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
        });
        video.setAttribute('onloadstart', 'this.volume=' + state.video_volume);
        video.setAttribute('autoplay', 'true');
        video.setAttribute('controls', 'true');
        if (state.video_loop) {
          video.setAttribute('loop', state.video_loop);
        } else if (state.video_autoclose) {
          video.addEventListener('ended', () => {
            shrink(current.lastElementChild, current);
          });
        }
        video.style.maxWidth = '100%';
        video.style.maxHeight = '85vh';
        video.style.height = 'auto';
        video.style.cursor = 'default';
        video.appendChild(source);

        current.parentElement.appendChild(video);
        break;
      case 'mp3':
      case 'wav':
      case 'ogg':
      case 'oga':
      case 'opus':
      case 'flac':
        target.style.minWidth = '270px';  

        let audio = document.createElement('audio');
        audio.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
        });
        audio.src = finfo.file_href;
        audio.setAttribute('onloadstart', 'this.volume=' + state.audio_volume);
        audio.setAttribute('autoplay', 'true');
        audio.setAttribute('controls', 'true');
        if (state.audio_loop) {
          audio.setAttribute('loop', state.audio_loop);
        } else if (state.audio_autoclose) {
          audio.addEventListener('ended', () => {
            shrink(current.lastElementChild, current);
          });
        }
        audio.style.width = target.width + 'px';
        audio.style.cursor = 'default';

        current.parentElement.appendChild(audio);
        break;
      case 'mod':
      case 'xm':
      case 'it':
      case 's3m':
      case 'med':
        let wrapper = document.createElement('div');
        wrapper.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
        });
        wrapper.style.width = target.width + 'px';
        wrapper.style.cursor = 'default';
        let mod_meta = document.createElement('div');
        mod_meta.style.overflow = 'hidden';
        mod_meta.style.whiteSpace = 'nowrap';
        mod_meta.style.width = wrapper.style.width;
        wrapper.appendChild(mod_meta);
        let mod_pos = document.createElement('input');
        mod_pos.setAttribute('type', 'range');
        mod_pos.style.width = wrapper.style.width;
        wrapper.appendChild(mod_pos);

        if (state.chiptune2js.player != null) {
          state.chiptune2js.player.stop();
        } else {
          state.chiptune2js.player = new ChiptuneJsPlayer(new ChiptuneJsConfig(
            -1,
            state.mod_stereo * 100.0,
            undefined,
            undefined
          ));
        }

        state.chiptune2js.player.load(finfo.file_href, (data) => {
          state.chiptune2js.player.play(data);

          const metadata = state.chiptune2js.player.metadata();
          let mod_meta_scroll = document.createElement('div');
          mod_meta_scroll.style.display = 'inline-block';
          mod_meta_scroll.style.animation = 'marquee 10s linear infinite';
          mod_meta_scroll.innerHTML += 'TITLE: ' + metadata.title;
          mod_meta_scroll.innerHTML += ', ';
          mod_meta_scroll.innerHTML += 'TRACKER: ' + metadata.tracker;
          mod_meta_scroll.innerHTML += ', ';
          mod_meta_scroll.innerHTML += 'TYPE: ' + metadata.type_long;
          mod_meta.appendChild(mod_meta_scroll);

          mod_pos.setAttribute('min', '0');
          mod_pos.setAttribute('max', state.chiptune2js.player.duration());
          mod_pos.setAttribute('value', '0');

          state.chiptune2js.interval = setInterval(() => {
            if (state.chiptune2js.player != null && state.chiptune2js.player.currentPlayingNode != null) {
              mod_pos.value = state.chiptune2js.player.getCurrentTime();
            }
          }, 1000);
        });

        current.appendChild(wrapper);
        break;
      case 'swf':
        target.style.display = 'none';

        const ruffle = window.RufflePlayer.newest();
        const player = ruffle.createPlayer();
        player.style.maxWidth = (window.innerWidth * 0.85) + 'px';
        player.style.maxHeight = (window.innerHeight * 0.85) + 'px';

        current.appendChild(player);
        player.load({
          url: finfo.file_href,
          autoplay: 'on',
          allowScriptAccess: false,
        }).then(() => {
          player.volume = state.swf_volume;
        });
        break;
      case 'embed': {
        target.style.display = 'none';

        let embed = document.createElement('div');
        embed.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
        });
        embed.innerHTML = decodeURIComponent(finfo.file_data);
        embed.style.minWidth = '50vw';
        embed.style.maxWidth = '85vw';
        embed.style.height = '50vh';
        embed.firstElementChild.width = '100%';
        embed.firstElementChild.height = '100%';

        current.appendChild(embed);
      } break;
      case 'pdf': {
        target.style.display = 'none';

        let embed = document.createElement('embed');
        embed.type = 'application/pdf';
        embed.src = finfo.file_href;
        embed.style.width = '85vw';
        embed.style.height = '85vh';

        current.appendChild(embed);
      } break;
      default:
        target.style.display = 'none';

        let img = document.createElement('img');
        img.src = finfo.file_href;
        img.style.maxWidth = '100%';
        img.style.maxHeight = '85vh';
        img.style.height = 'auto';
        img.loading = 'lazy';

        current.appendChild(img);
        break;
    }

    // shrink specific media elements that were already expanded
    const exp_elements = document.querySelectorAll('[expanded="true"]');
    Array.from(exp_elements).forEach((exp_element) => {
      const shrink_types = ['AUDIO', 'VIDEO', 'RUFFLE-PLAYER', 'DIV'];

      // select the element's container based on file ext
      // NOTE: this is because <video> is created inside the parent <div>
      //       because <video> inside <a> is glitchy
      const exts_video_audio = FILE_EXTS_VIDEO.concat(FILE_EXTS_AUDIO);
      const exp_finfo = get_finfo(exp_element.parentElement.parentElement);
      const exp_container = exts_video_audio.includes(exp_finfo.file_ext) ?
        exp_element.parentElement :
        exp_element;
      const curr_container = exts_video_audio.includes(finfo.file_ext) ?
        current.parentElement :
        current;
      
      const exp_node_type = exp_container.lastElementChild.nodeName;
      const curr_node_type = curr_container.lastElementChild.nodeName;

      if (shrink_types.includes(exp_node_type) && shrink_types.includes(curr_node_type)) {
        shrink(exp_element.lastElementChild, exp_element);
      }
    });

    // make expanded element shrinkable via an anchor element
    let anchor = document.createElement('a');
    anchor.href = '';
    anchor.innerHTML = '[-]';
    anchor.classList.add('file-shrink-href')
    anchor.onclick = function(event) {
      event.preventDefault();
      event.stopPropagation();

      shrink(current.lastElementChild, current);
    }
    finfo.file_info.prepend(anchor);

    current.setAttribute('expanded', 'true');
  };
  
  if (event_current.getAttribute('expanded') !== 'true') {
    expand(event_target, event_current);
  } else {
    // TODO: this is a hack, to prevent SWF from closing on click
    const finfo = get_finfo(event_current.parentElement.parentElement);
    if (finfo.file_ext !== 'swf') {
      shrink(event_target, event_current);
    }
  }
}

/**
 * Event listener: click on dropdown menu button.
 * Opens/closes the menu.
 * @param {*} event 
 */
function listener_dropdown_menu_button_click(event) {
  event.preventDefault();

  let target = event.target;
  let rect = target.getBoundingClientRect();
  let data = target.dataset;

  // open or close the menu
  if (!target.classList.contains('dd-menu-btn-open')) {
    target.classList.add('dd-menu-btn-open');

    switch (data.cmd) {
      case 'post-menu':
        let lis = [];
        lis.push({
          type: 'li',
          text: 'Report post',
          data: {
            cmd: 'report',
            board_id: data.board_id,
            id: data.id
          }
        });
        if (data.parent_id == null) {
          lis.push({
            type: 'li',
            text: !location.pathname.includes('/hidden/') ? 'Hide thread' : 'Unhide thread',
            data: {
              cmd: 'hide',
              board_id: data.board_id,
              id: data.id
            }
          });
        }
        let file_info = get_finfo(document.getElementById(data.board_id + '-' + data.id));
        if (file_info != null && file_info.file_ext !== 'embed') {
          lis.push({
            type: 'li',
            text: 'Download original',
            data: {
              cmd: 'file_download',
              board_id: data.board_id,
              id: data.id
            }
          });
        }
        if (file_info != null && FILE_EXTS_IMAGE.includes(file_info.file_ext)) {
          lis.push({
            type: 'li',
            text: 'Tegaki: Open image',
            data: {
              cmd: 'tegaki_open',
              cmd_data: {
                url: file_info.file_href,
              },
              board_id: data.board_id,
              id: data.id
            }
          });
        }
        let album_link = document.getElementById('album-' + data.board_id + '-' + data.id);
        if (album_link != null && album_link.innerText.length > 0) {
          lis.push({
            type: 'li',
            text: 'Audio: Album art',
            data: {
              cmd: 'audio_album',
              cmd_data: {
                url: album_link.innerText,
              },
              board_id: data.board_id,
              id: data.id
            }
          });
        }
        let thumb_img = document.getElementById('thumb-' + data.board_id + '-' + data.id);
        if (thumb_img != null && !thumb_img.src.includes('/static/')) {
          lis.push({
            type: 'li',
            text: 'Search: SauceNAO',
            data: {
              cmd: 'search_thumb',
              cmd_data: {
                url: 'https://saucenao.com/search.php?url=',
              },
              board_id: data.board_id,
              id: data.id
            }
          }, {
            type: 'li',
            text: 'Search: IQDB',
            data: {
              cmd: 'search_thumb',
              cmd_data: {
                url: 'http://iqdb.org/?url=',
              },
              board_id: data.board_id,
              id: data.id
            }
          }, {
            type: 'li',
            text: 'Search: IQDB 3D',
            data: {
              cmd: 'search_thumb',
              cmd_data: {
                url: 'http://3d.iqdb.org/?url=',
              },
              board_id: data.board_id,
              id: data.id
            }
          }, {
            type: 'li',
            text: 'Search: ASCII2D',
            data: {
              cmd: 'search_thumb',
              cmd_data: {
                url: 'https://ascii2d.net/search/url/',
              },
              board_id: data.board_id,
              id: data.id
            }
          }, {
            type: 'li',
            text: 'Search: TinEye',
            data: {
              cmd: 'search_thumb',
              cmd_data: {
                url: 'https://tineye.com/search?url=',
              },
              board_id: data.board_id,
              id: data.id
            }
          });
        }
        create_dropdown_menu(target, data.board_id, data.parent_id, data.id, rect, lis);
        break;
      default:
        break;
    }
  } else {
    delete_dropdown_menu(data.id);
  }
}

/**
 * Event listener: focus shifts from dropdown menu button.
 * Closes all dropdown menus.
 * @param {*} event 
 */
function listener_dropdown_menu_button_blur(event) {
  event.preventDefault();

  let target_related = event.relatedTarget;

  if (target_related == null) {
    delete_dropdown_menu();
  }
}

/**
 * Event listener: mouse over on post reference link.
 * Opens a preview.
 * @param {*} event 
 */
function listener_post_reference_link_mouseenter(event) {
  event.preventDefault();

  // update state
  state.mouse_over_post_ref_link = true;

  let target = event.target;
  let rect = target.getBoundingClientRect();
  let data = target.dataset;
  
  if (data.board_id == null || data.parent_id == null || data.id == null) {
    return;
  }

  const key = data.board_id + '/' + data.parent_id + '/' + data.id;

  if (state.post_preview_cache[key] == null) {
    let xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
      if (!state.mouse_over_post_ref_link) {
        xhr.abort();
        return;
      }
  
      if (xhr.readyState !== XMLHttpRequest.DONE) {
        return;
      }
      
      state.post_preview_cache[key] = xhr.responseText;
      create_post_preview(target, data.board_id, data.parent_id, data.id, rect, false, xhr.responseText);
    }
    xhr.open('GET', '/' + data.board_id + '/' + data.parent_id + '/' + data.id, true);
    xhr.send();
  } else {
    create_post_preview(target, data.board_id, data.parent_id, data.id, rect, false, state.post_preview_cache[key]);
  }
}

/**
 * Event listener: mouse out from post reference link.
 * Closes all opened previews.
 * @param {*} event 
 */
function listener_post_reference_link_mouseleave(event) {
  event.preventDefault();

  // update state
  state.mouse_over_post_ref_link = false;

  delete_post_previews(event.target);
}

/**
 * Event listener: click on dropdown menu indice.
 * Executes menu action.
 * @param {*} event 
 */
 function listener_dropdown_menu_indice(event) {
  event.preventDefault();

  let target = event.target;
  let rect = target.getBoundingClientRect();
  let data = target.dataset;
  let thumb = document.getElementById('thumb-' + data.board_id + '-' + data.id);

  switch (data.cmd) {
    case 'report':
      ui_window.open_native('/' + data.board_id + '/' + data.id + '/report', '_blank', 'location=true,status=true,width=480,height=640');
      break;
    case 'hide':
      let xhr = new XMLHttpRequest();
      xhr.onreadystatechange = function() {
        if (xhr.readyState !== XMLHttpRequest.DONE) {
          return;
        }

        let thread = document.getElementById('thread_' + data.board_id + '-' + data.id);
        if (thread != null) {
          let divider = thread.nextElementSibling;
          if (divider != null && divider.nodeName === 'HR') {
            divider.remove();
          }

          thread.remove();
        }
      };
      xhr.open('POST', '/' + data.board_id + '/' + data.id + '/hide', true);
      xhr.send();
      break;
    case 'file_download':
      window.location.assign('/' + data.board_id + '/' + data.id + '/download');
      break;
    case 'tegaki_open':
      window.Tegaki.open({
        onDone: tegaki_on_done,
        onCancel: tegaki_on_cancel,
        width: 512,
        height: 512,
      });
      let img = new Image();
      img.onload = window.Tegaki.onOpenImageLoaded;
      img.onerror = window.Tegaki.onOpenImageError;
      img.src = data.url;
      break;
    case 'audio_album':
      ui_window.open_native(data.url, '_blank');
      break;
    case 'search_thumb':
      if (thumb != null) {
        ui_window.open_native(data.url + thumb.src, '_blank');
      }
      break;
    default:
      console.error('listener_dropdown_menu_indice unhandled cmd: ' + data.cmd);
  }
  
  delete_dropdown_menu(data.id);
}

function select_postform_element(id) {
  return document.getElementById(`form-reply::${id}`) || document.getElementById(`${id}`);
}

/**
 * Creates a new dropdown menu.
 * @param {string} board_id 
 * @param {number} id 
 * @param {Rect} rect 
 * @param {array} indices 
 */
function create_dropdown_menu(target, board_id, parent_id, id, rect, indices) {
  // create container element
  let div = document.createElement('div');
  div.dataset.board_id = board_id;
  div.dataset.parent_id = parent_id;
  div.dataset.id = id;
  div.classList.add('dd-menu');
  div.style.top = (rect.bottom + window.scrollY) + 'px';
  div.style.left = (rect.left + window.scrollX) + 'px';
  div.tabIndex = -1; // blur event hack

  // create list element
  let ul = document.createElement('ul');

  // create menu indice elements
  indices.forEach(indice => {
    switch (indice.type) {
      case 'li':
        let li = document.createElement('li');
        li.dataset.cmd = indice.data.cmd;
        if (indice.data.cmd_data != null) {
          for (const [key, value] of Object.entries(indice.data.cmd_data)) {
            li.dataset[key] = value;
          }
        }
        li.dataset.board_id = indice.data.board_id;
        li.dataset.id = indice.data.id;
        li.innerHTML = indice.text;
        
        li.addEventListener('click', listener_dropdown_menu_indice);

        // append to list
        ul.appendChild(li);
        break;
    }
  });

  // append list to container
  div.appendChild(ul);

  // append container to body
  // NOTE: figure out why appending to target glitches out
  document.body.appendChild(div);

  // get initial container client rect
  let div_rect = div.getBoundingClientRect();

  // shift container up if overflow-y
  if (div_rect.bottom > window.innerHeight) {
    div.style.top = (rect.top + window.scrollY - div_rect.height) + 'px';
  }

  // shift container left if overflow-x
  div_rect = div.getBoundingClientRect();
  if (div_rect.right > window.innerWidth) {
    div.style.left = (rect.right + window.scrollX - div_rect.width) + 'px';
  }
}

/**
 * Creates a new post preview.
 * @param {string} board_id 
 * @param {number} parent_id 
 * @param {number} id 
 * @param {Rect} rect 
 * @param {array} content 
 */
function create_post_preview(target, board_id, parent_id, id, rect, swap_x, content) {
  // get target bounding client rect
  let target_rect = rect;

  // create container element
  let div = document.createElement('div');
  div.dataset.board_id = board_id;
  div.dataset.parent_id = parent_id;
  div.dataset.id = id;
  div.classList.add('post-preview');
  div.style.left = '0';
  div.style.top = '0';
  div.style.right = 'auto';
  div.style.bottom = 'auto';

  // append post HTML content
  div.innerHTML = content;

  // append container to target element
  target.appendChild(div);

  // get container bounding client rect
  let div_rect = div.getBoundingClientRect();

  // position container in viewport
  div.style.left = target_rect.right + 'px';
  div.style.top = (target_rect.bottom - div_rect.height * 0.5) + 'px';

  // overflow on y-axis: shift container up/down by overflow amount
  div_rect = div.getBoundingClientRect();
  if (div_rect.bottom > window.innerHeight) {
    let overflow_y = div_rect.bottom - window.innerHeight;
    div.style.top = (parseInt(div.style.top, 10) - overflow_y) + 'px';
  } else if (div_rect.top < 0) {
    let overflow_y = div_rect.top;
    div.style.top = (parseInt(div.style.top, 10) - overflow_y) + 'px';
  }

  // overflow on x-axis: shift container left/right by overflow amount
  div_rect = div.getBoundingClientRect();
  if (div_rect.right > window.innerWidth) {
    if (swap_x) {
      div.style.left = 'auto';
      div.style.right = (window.innerWidth - parseInt(target_rect.left, 10)) + 'px';
    } else {
      let overflow_x = div_rect.right - window.innerWidth;
      div.style.left = (parseInt(div.style.left, 10) - overflow_x) + 'px';
    }
  } else if (div_rect.left < 0) {
    let overflow_x = div_rect.left;
    div.style.left = (parseInt(div.style.left, 10) - overflow_x) + 'px';
  }

  // recursively init container post ref link and hashid features
  init_post_reference_links(div);
  init_post_hashid_features(div);
}

/**
 * Deletes an existing dropdown menu by id.
 * @param {number} id 
 */
function delete_dropdown_menu(id) {
  let dd_menus = document.getElementsByClassName('dd-menu');

  Array.from(dd_menus).forEach(element => {
    if (id == null || element.dataset.id === id) {
      element.remove();
    }
  });

  let dd_menu_btns = document.getElementsByClassName('dd-menu-btn');

  Array.from(dd_menu_btns).forEach(element => {
    if (id == null || element.dataset.id === id) {
      element.classList.remove('dd-menu-btn-open');
    }
  });
}

/**
 * Deletes all existing post previews under target element.
 * @param {*} target 
 */
function delete_post_previews(target) {
  if (target == null) {
    target = document;
  }

  let post_previews = target.getElementsByClassName('post-preview');
  Array.from(post_previews).forEach(element => {
    element.remove();
  });
}

/**
 * Highlights a post by id.
 * @param {*} id 
 */
function create_post_highlight(id) {
  // cleanup old highlights
  let highlighted_elements = document.getElementsByClassName('highlight');

  Array.from(highlighted_elements).forEach(element => {
    element.classList.remove('highlight');
  });

  // add current highlight
  let post_element = document.getElementById(id);
  
  if (post_element != null && post_element.classList.contains('reply')) {
    post_element.classList.add('highlight');
  }
}

/**
 * Creates a fixed position settings window.
 * @param {*} variables 
 */
function create_settings_window(variables) {
  const create_settings_variable = (target_div, variable) => {
    const div_var = document.createElement('div');
    div_var.style.clear = 'both';
    div_var.style.overflow = 'auto';
    const div_var_name = document.createElement('div');
    div_var_name.style.float = 'left';
    div_var_name.style.marginRight = '16px';
    div_var_name.textContent = variable.name;
    div_var.appendChild(div_var_name);
    const div_var_value = document.createElement('div');
    div_var_value.style.float = 'right';

    let div_var_value_data = null;
    switch (variable.type) {
      case 'bool':
        div_var_value_data = document.createElement('input');
        div_var_value_data.type = 'checkbox';
        div_var_value_data.checked = storage.get_lsvar_bool(variable.key, variable.def);
        break;
      case 'string':
        div_var_value_data = document.createElement('input');
        div_var_value_data.type = 'text';
        div_var_value_data.value = storage.get_lsvar(variable.key, variable.def);
        break;
      case 'float':
        div_var_value_data = document.createElement('input');
        div_var_value_data.type = 'number';
        div_var_value_data.min = variable.min;
        div_var_value_data.max = variable.max;
        div_var_value_data.step = variable.step;
        div_var_value_data.value = storage.get_lsvar(variable.key, variable.def);
        break;
      case 'string_multiline':
        div_var_value_data = document.createElement('textarea');
        div_var_value_data.rows = '4';
        div_var_value_data.value = storage.get_lsvar(variable.key, variable.def);
        break;
      case 'float_slider':
        div_var_value_data = document.createElement('input');
        div_var_value_data.type = 'range';
        div_var_value_data.min = variable.min;
        div_var_value_data.max = variable.max;
        div_var_value_data.step = variable.step;
        div_var_value_data.value = storage.get_lsvar(variable.key, variable.def);
        break;
      case 'element':
        div_var_value_data = document.getElementById(variable.id)?.cloneNode(true);
        if (div_var_value_data != null) {
          div_var_value_data.id += '_settings_var';
          div_var_value_data.style = '';
          if (variable.callback != null) {
            variable.callback(div_var_value_data);
          }
        }
        break;
    }
    if (variable.key != null) {
      div_var_value_data.addEventListener('change', (event) => {
        const val_data = variable.type === 'bool' ? event.target.checked : event.target.value;
        storage.set_lsvar(variable.key, val_data);
      });
    }
    div_var_value.appendChild(div_var_value_data);

    div_var.appendChild(div_var_value);

    target_div.appendChild(div_var);
  };

  const div_content = document.createElement('div');

  variables.forEach((variable) => {
    create_settings_variable(div_content, variable);
  });

  const btn_apply = document.createElement('button');
  btn_apply.type = 'button';
  btn_apply.innerHTML = 'Apply';
  btn_apply.addEventListener('click', (event) => {
    apply_settings();
  });
  div_content.appendChild(btn_apply);
  
  const div_fixed_window = ui_window.open(
    'settingswindow',
    'Settings',
    0,
    0,
    null,
    null,
    true,
    div_content
  );
  document.body.appendChild(div_fixed_window.element);
  const client_rect = div_fixed_window.element.getBoundingClientRect();
  div_fixed_window.setXY(
    window.innerWidth * 0.5 - client_rect.width * 0.5,
    window.innerHeight * 0.5 - client_rect.height * 0.5
  );
}

function create_quickreply_window(target) {
  // clone the base of postform
  const form_post = document.getElementById('form-post');
  if (form_post == null) {
    return;
  }
  const form_reply = form_post.cloneNode(false);

  // construct replyform
  form_post.querySelectorAll('input,button[id=\'form-draw\']')
    .forEach((x, i) => {
    const form_reply_input = x.tagName === 'INPUT' ? x.cloneNode() : x.cloneNode(true);
    let form_reply_input_container = form_reply_input;
    if (form_reply_input.type === 'checkbox') {
      const form_reply_label = document.createElement('label');
      form_reply_label.innerText = form_reply_input.name;
      form_reply_label.prepend(form_reply_input);
      form_reply_input_container = form_reply_label;
    } else {
      form_reply_input.placeholder = x.name;
    }
    form_reply.appendChild(form_reply_input_container);
    if (['email', 'capcode', 'submit', 'draw', 'anonfile', 'password'].includes(x.name)) {
      form_reply.appendChild(document.createElement('br'));
    }
  });
  const form_post_captcha = form_post.querySelector('#form-post-captcha');
  if (form_post_captcha != null) {
    form_reply.appendChild(form_post_captcha.cloneNode());
  }
  const form_post_format_btns = form_post.querySelectorAll('.format-btn');
  form_post_format_btns.forEach((x) => {
    const format_btn = x.cloneNode(true);
    form_reply.appendChild(format_btn);
  });
  form_reply.appendChild(document.createElement('br'));
  const form_post_message = form_post.querySelector('#form-post-message')
  const form_reply_message = form_post_message.cloneNode();
  form_reply_message.placeholder = form_reply_message.name;
  form_reply_message.addEventListener('input', (event) => {
    form_post_message.value = event.target.value;
  });
  form_reply.appendChild(form_reply_message);

  const div_content = document.createElement('div');
  div_content.appendChild(form_reply);
  const form_reply_ids = div_content.querySelectorAll('[id]');
  form_reply_ids.forEach((x) => x.id = 'form-reply::' + x.id);

  const target_rect = target.getBoundingClientRect();
  const div_fixed_window = ui_window.open(
    'quickreplywindow',
    'Quick Reply',
    target_rect.right,
    target_rect.bottom + 4,
    null,
    null,
    true,
    div_content
  );
  const div_fixed_window_content = div_fixed_window.element.querySelector('.box-content');
  div_fixed_window_content.style = 'padding: 0;';
  document.body.appendChild(div_fixed_window.element);

  // shift container up if overflow-y
  let div_rect = div_fixed_window.element.getBoundingClientRect();
  if (div_rect.bottom > window.innerHeight) {
    div_fixed_window.setXY(div_fixed_window.pos.x, div_fixed_window.pos.y - (div_rect.bottom - window.innerHeight));
  }

  // shift container up if overflow-x
  div_rect = div_fixed_window.element.getBoundingClientRect();
  if (div_rect.right > window.innerWidth) {
    div_fixed_window.setXY(div_fixed_window.pos.x - (div_rect.right - window.innerWidth), div_fixed_window.pos.y);
  }
  
  // init features for the new replyform
  console.time('init_postform_features');
  init_postform_features('form-reply\\:\\:');
  console.timeEnd('init_postform_features');

  // init captcha
  if (form_post_captcha != null && window.hcaptcha != null) {
    window.hcaptcha.render('form-reply::form-post-captcha');
  }
}

/**
 * Applies all currently saved settings.
 */
function apply_settings() {
  state.menubar_detach = storage.get_lsvar_bool('menubar_detach', state.menubar_detach);
  state.thread_quickreply = storage.get_lsvar_bool('thread_quickreply', state.thread_quickreply);
  state.thread_auto_update.enabled = storage.get_lsvar_bool('thread_auto_update', state.thread_auto_update.enabled);
  state.audio_loop = storage.get_lsvar_bool('audio_loop', state.audio_loop);
  state.video_loop = storage.get_lsvar_bool('video_loop', state.video_loop);
  state.audio_autoclose = storage.get_lsvar_bool('audio_autoclose', state.audio_autoclose);
  state.video_autoclose = storage.get_lsvar_bool('video_autoclose', state.video_autoclose);
  state.audio_volume = parseFloat(storage.get_lsvar('audio_volume', state.audio_volume));
  state.video_volume = parseFloat(storage.get_lsvar('video_volume', state.video_volume));
  state.swf_volume = parseFloat(storage.get_lsvar('swf_volume', state.swf_volume));
  state.mod_stereo = parseFloat(storage.get_lsvar('mod_stereo', state.mod_stereo));
  const css_override = storage.get_lsvar('css_override', '');
  const js_override = storage.get_lsvar('js_override', '');

  if (css_override != null && css_override.length > 0) {
    let style_element = document.getElementById('css_override');
    if (style_element == null) {
      style_element = document.createElement('style');
      style_element.id = 'css_override';
    }
    style_element.innerHTML = css_override;
    document.head.appendChild(style_element);
  }

  if (js_override != null && js_override.length > 0) {
    let script_element = document.getElementById('js_override');
    if (script_element == null) {
      script_element = document.createElement('script');
      script_element.id = 'js_override';
    }
    script_element.innerHTML = js_override;
    document.head.appendChild(script_element);
  }

  const menubar_element = document.getElementById('menubar');
  if (state.menubar_detach && menubar_element) {
    menubar_element.classList.add('menubar-detached');
    document.body.style.padding = '40px 8px 8px 8px';
  } else if (!state.menubar_detach && menubar_element) {
    menubar_element.classList.remove('menubar-detached');
    document.body.style.padding = '8px 8px 8px 8px';
  }

  console.log(state);
}

/**
 * Opens the quick reply window and focuses it on target post.
 * @param {*} id 
 * @returns 
 */
function open_quickreply_on_post(id) {
  const post_div = document.querySelector(`.post[id$='-${id}']`);
  if (post_div == null) {
    return;
  }

  const post_target = post_div.querySelector('.post-id');
  if (!utils.isVisible(post_div, 32, 'visible')) {
    post_target.scrollIntoView({
      behavior: 'instant',
      block: 'center',
    });
  }

  const post_form_message = document.getElementById('form-post-message');
  if (utils.isVisible(post_form_message, 32, 'visible')) {
    return;
  }

  const form_reply = document.getElementById('quickreplywindow');
  if (!form_reply) {
    create_quickreply_window(post_target);
  }
}

/**
 * Insert a post id ref + selected text to the message.
 * @param {*} id 
 * @returns 
 */
function insert_ref_to_message(id) {
  let postform_message = select_postform_element('form-post-message');
  if (postform_message == null) {
    return;
  }

  let text_idx = postform_message.selectionEnd;
  let text_val = postform_message.value;
  let text_ref = '>>' + id + '\n';
  postform_message.value = text_val.slice(0, text_idx) + text_ref + text_val.slice(text_idx);
  postform_message.setSelectionRange(text_idx + text_ref.length, text_idx + text_ref.length);
  const post_div = document.querySelector(`.post[id$='-${id}']`);
  let text_sel = window.getSelection();
  if (text_sel.rangeCount > 0 && post_div != null) {
    text_sel = text_sel.getRangeAt(0);
    let text = text_sel.toString().trim();
    if (text.length > 0 && post_div.contains(text_sel.commonAncestorContainer.parentElement)) {
      text = text
        .split('\n')
        .join('\n>');
      postform_message.value += '>' + text.trim() + '\n';
    }
  }
  postform_message.focus();
}

/**
 * Insert a formatting tag to the message.
 * @param {*} format 
 * @returns 
 */
function insert_format_to_message(format) {
  let postform_message = select_postform_element('form-post-message');

  if (postform_message == null) {
    return;
  }

  let text_idx_s = postform_message.selectionStart;
  let text_idx_e = postform_message.selectionEnd;
  let text_val = postform_message.value;
  postform_message.value = text_val.slice(0, text_idx_s) + '[' + format + ']'
                         + text_val.slice(text_idx_s, text_idx_e) + '[/' + format + ']'
                         + text_val.slice(text_idx_e);
  postform_message.setSelectionRange(text_idx_s + (2 + format.length), text_idx_s + (2 + format.length));
  postform_message.focus();
}

/**
 * Initializes all post file thumbnail hrefs under target element.
 * @param {*} target 
 */
function init_post_thumb_links(target) {
  if (target == null) {
    target = document;
  }

  let post_thumb_links = target.getElementsByClassName('file-thumb-href');
  Array.from(post_thumb_links).forEach(element => {
    element.addEventListener('click', listener_post_thumb_link_click);
  });
}

/**
 * Initializes all dropdown menu buttons under target element.
 * @param {*} target 
 */
function init_dropdown_menu_buttons(target) {
  if (target == null) {
    target = document;
  }

  let dd_menu_btns = target.getElementsByClassName('dd-menu-btn');
  Array.from(dd_menu_btns).forEach(element => {
    element.addEventListener('click', listener_dropdown_menu_button_click);
    element.addEventListener('blur', listener_dropdown_menu_button_blur);
  });
}

/**
 * Initializes all post reference links under target element.
 * @param {*} target 
 */
function init_post_reference_links(target) {
  if (target == null) {
    target = document;
  }

  const post_ref_links = target.getElementsByClassName('reference');
  Array.from(post_ref_links).forEach(element => {
    element.addEventListener('mouseenter', listener_post_reference_link_mouseenter);
    element.addEventListener('mouseleave', listener_post_reference_link_mouseleave);
  });
}

/**
 * Initializes all post backreference links, cleans up existing first.
 * @param {*} target 
 */
function init_post_backreference_links(newPosts) {
  console.time("** find post ids whose backreferences to modify");
  // find post ids with new links to them
  let target_to_sources = {}; // "int-12345" -> {id, ref}[]
  for (let np of newPosts || [document]) {
    for (let ql of np.querySelectorAll('.post:not(.preview) a.reference')) {
      // .board_id is board being linked to
      // .parent_id is the target thread id (if not OP)
      // .id is the postnum being linked to
      let sourceId = ql.closest('.post').id;
      let targetId = ql.dataset.board_id + "-" + ql.dataset.id;
      let sources = (target_to_sources[targetId] = (target_to_sources[targetId] || []));
      if (!sources.find((s) => s.id === sourceId))
        sources.push({
          id: sourceId,
          ref: ql,
        });
    }
  }
  console.timeEnd("** find post ids whose backreferences to modify");

  let num_notfound = 0;
  let num_added = 0;
  console.time("** add backreferences");
  for (let targetId in target_to_sources) {
    let target = document.getElementById(targetId);
    if (!target) {
      num_notfound++;
      continue;
    }

    // append to post-info section
    let target_post_info = target.querySelector('.post-info');

    for (let source of target_to_sources[targetId]) {
      // work out some variables
      let board_id = source.ref.dataset.board_id;
      let parent_id = source.ref.dataset.parent_id;
      let post_id = source.id.split('-')[1];

      // construct the backreference element
      let backreference = document.createElement('a');
      backreference.classList.add('backreference');
      if (parent_id == null) {
        backreference.href = '/' + board_id + '/' + post_id + '/';
        backreference.dataset.board_id = board_id;
        backreference.dataset.parent_id = post_id;
        backreference.dataset.id = post_id;
      } else {
        backreference.href = '/' + board_id + '/' + parent_id + '/#' + board_id + '-' + post_id;
        backreference.dataset.board_id = board_id;
        backreference.dataset.parent_id = parent_id;
        backreference.dataset.id = post_id;
      }
      backreference.textContent = '>>' + post_id;
      backreference.addEventListener('mouseenter', listener_post_reference_link_mouseenter);
      backreference.addEventListener('mouseleave', listener_post_reference_link_mouseleave);

      target_post_info.appendChild(new Text(' '));
      target_post_info.appendChild(backreference);
      num_added++;
    }
  }
  console.timeEnd("** add backreferences");
  console.log("num_added", num_added);
  console.log("num_notfound", num_notfound);
}

/**
 * Initializes all post hashid fields with unique RGB color hash under target element.
 * @param {*} target 
 */
function init_post_hashid_features(target) {
  if (target == null) {
    target = document;
  }

  let hashid_elements = target.getElementsByClassName('post-hashid-hash');
  Array.from(hashid_elements).forEach(element => {
    // calculate hashid bg color by simple hash to rgb
    const hid_bg = utils.toHex(element.innerHTML);

    // calculate hashid bg color luminance
    const hid_bg_rgb = parseInt(hid_bg.substring(1), 16);
    const hid_bg_r = (hid_bg_rgb >> 16) & 0xff;
    const hid_bg_g = (hid_bg_rgb >> 8) & 0xff;
    const hid_bg_b = hid_bg_rgb & 0xff;
    const hid_bg_l = 0.2126 * hid_bg_r + 0.7152 * hid_bg_g + 0.0722 * hid_bg_b;

    // set the hashid bgcolor and also set font color based on luminance
    element.style.backgroundColor = hid_bg;
    element.style.color = hid_bg_l < 100 ? '#ffffff' : '#000000';
  });
}

/**
 * Initializes features related to interpreting location.hash value.
 * - Post highlights (#ID)
 * - Insert post ref link to postform message (#qID)
 */
function init_location_hash_features() {
  function highlight_or_ref(hash) {
    if (hash.startsWith('#q')) {
      const post_id = hash.substring(2);

      // if enabled: create quickreply window
      if (state.thread_quickreply) {
        open_quickreply_on_post(post_id);
      }

      insert_ref_to_message(post_id);
      
      // reset hash to allow ref again
      history.replaceState(null, '', './');
    } else if (hash.length > 1) {
      create_post_highlight(hash.substring(1));
    }
  }

  if (location.hash.length > 1) {
    highlight_or_ref(location.hash);
  }
  
  window.addEventListener('hashchange', function(event) {
    highlight_or_ref(location.hash);
  });
}

function create_error_window(content) {
  const div_content = document.createElement('div');
  div_content.innerHTML = content;
  const fixed_window = ui_window.open(
    'errorwindow',
    'Error',
    0,
    0,
    null,
    null,
    true,
    div_content
  );
  document.body.appendChild(fixed_window.element);
  const client_rect = fixed_window.element.getBoundingClientRect();
  fixed_window.setXY(
    window.innerWidth * 0.5 - client_rect.width * 0.5,
    window.innerHeight * 0.5 - client_rect.height * 0.5
  );
}

/**
 * Initializes features related to postform fields.
 * - Remember password (local cookie)
 */
function init_postform_features(target_id_prefix) {
  const post_form = document.querySelector(`#${target_id_prefix}form-post`);
  if (post_form == null) {
    return;
  }

  // update password fields appropriately
  let cookie_pass = storage.get_cookie('password');
  let postform_pass = post_form.querySelector(`#${target_id_prefix}form-post-password`);
  let deleteform_pass = document.getElementById('deleteform-password');

  if (postform_pass != null) {
    if (cookie_pass != null) {
      postform_pass.value = cookie_pass;
      if (deleteform_pass != null) {
        deleteform_pass.value = cookie_pass;
      }
    }

    let cookie_pass_expires = new Date();
    cookie_pass_expires.setFullYear(cookie_pass_expires.getFullYear() + 10);
    postform_pass.addEventListener('input', function(event) {
      storage.set_cookie('password', event.target.value, 'Lax', cookie_pass_expires);
      
      if (deleteform_pass != null) {
        deleteform_pass.value = event.target.value;
      }
    });
  }

  // setup submit handler
  if (post_form != null) {
    let submit_btn = post_form.querySelector('input[type=submit]');
    
    post_form.addEventListener('submit', (event) => {
      event.preventDefault();
      
      submit_btn.disabled = true;
      fetch(post_form.action, {
        method: 'POST',
        body: new FormData(post_form)
      }).then((data) => {
        data.text().then((response) => {
          try {
            const data_json = JSON.parse(response);

            // 200 OK, follow redirect
            if (data.status === 200 && data_json['redirect_url'] != null) {
              window.location.href = window.location.origin + data_json['redirect_url'];
              setTimeout(() => {
                window.location.reload(true);
              }, 250);
            // xxx ERROR, show error window
            } else {
              create_error_window(data_json['error_message']);
              submit_btn.disabled = false;
            }
          } catch (error) {
            create_error_window(response);
            submit_btn.disabled = false;
          }
        });
      }).catch((error) => {
        create_error_window(error);
        submit_btn.disabled = false;
      });
    });
  }

  // init post formatting buttons
  if (post_form != null) {
    let formatting_btns = post_form.getElementsByClassName('format-btn');
    Array.from(formatting_btns).forEach(element => {
      element.addEventListener('click', (event) => {
        insert_format_to_message(event.currentTarget.dataset.format);
      });
    });
  }

  // init file pasting
  if (post_form != null) {
    let postform_message = post_form.querySelector(`#${target_id_prefix}form-post-message`);
    postform_message.addEventListener('paste', (event) => {
      if (event.clipboardData.files.length > 0) {
        event.preventDefault();
        let fileInput = post_form.querySelector(`#${target_id_prefix}form-file`);
        if (fileInput !== null) {
          fileInput.files = event.clipboardData.files;
        }
      }
    });
  }

  // init file drawing (Tegaki)
  if (window.Tegaki != null && post_form != null) {
    const postform_draw = post_form.querySelector(`#${target_id_prefix}form-draw`);
    if (postform_draw != null) {
      postform_draw.addEventListener('click', (event) => {
        console.log('tegaki: created');
  
        window.Tegaki.open({
          onDone: tegaki_on_done,
          onCancel: tegaki_on_cancel,
          width: 512,
          height: 512,
        });
      });
    }
  }
}

/**
 * Initializes features related to deleteform fields.
 */
function init_deleteform_features() {
  const delete_form = document.getElementById('deleteform');

  // setup submit handler
  if (delete_form != null) {
    let submit_btn = delete_form.querySelector('input[type=submit]');

    delete_form.addEventListener('submit', (event) => {
      event.preventDefault();
      
      submit_btn.disabled = true;
      fetch(delete_form.action, {
        method: 'POST',
        body: new FormData(delete_form)
      }).then((data) => {
        data.text().then((response) => {
          try {
            const data_json = JSON.parse(response);

            // 200 OK, follow redirect
            if (data.status === 200 && data_json['redirect_url'] != null) {
              window.location.href = window.location.origin + data_json['redirect_url'];
              setTimeout(() => {
                window.location.reload(true);
              }, 250);
            // xxx ERROR, show error window
            } else {
              create_error_window(data_json['error_message']);
              submit_btn.disabled = false;
            }
          } catch (error) {
            create_error_window(response);
            submit_btn.disabled = false;
          }
        });
      }).catch((error) => {
        create_error_window(error);
        submit_btn.disabled = false;
      });
    });
  }
}

/**
 * Initializes features related to thread view.
 * @returns 
 */
function init_thread_features() {
  const mode = document.getElementById('mode');
  if (mode == null || mode.innerText != 'Reply') {
    return;
  }

  const get_last_post_id = (target) => {
    if (target == null) {
      target = document;
    }
    
    const thread_div = target.querySelector('.thread');
    let last_post_div = null;
    if (thread_div != null) {
      last_post_div = thread_div.lastElementChild.querySelector('.post:not(.preview)');
    } else {
      last_post_div = Array.from(target.querySelectorAll('.post:not(.preview)')).pop();
    }

    return last_post_div != null
      ? parseInt(last_post_div.id.split('-')[1], 10)
      : null;
  };

  if (state.thread_auto_update.enabled) {
    state.thread_auto_update.post_id_after = get_last_post_id();
    state.thread_auto_update.interval = setInterval(() => {
      fetch(utils.removeTrailingSlash(window.location.pathname) + '/replies/?post_id_after=' + state.thread_auto_update.post_id_after, {
        method: 'GET'
      }).then((response) => response.text())
        .then((data) => {
          if (data == null || data.length === 0) {
            return;
          }

          // create temp div to hold the elements
          let tmp_div = document.createElement('div');
          tmp_div.innerHTML = data;

          // validate temp div contents (caching issues could cause same response as before)
          const tmp_div_last_post_id = get_last_post_id(tmp_div);
          if (!Number.isInteger(tmp_div_last_post_id) || tmp_div_last_post_id <= state.thread_auto_update.post_id_after) {
            return;
          }

          // init features for the new post elements
          console.time('init_post_thumb_links');
          init_post_thumb_links(tmp_div);
          console.timeEnd('init_post_thumb_links');

          console.time('init_dropdown_menu_buttons');
          init_dropdown_menu_buttons(tmp_div);
          console.timeEnd('init_dropdown_menu_buttons');

          console.time('init_post_reference_links');
          init_post_reference_links(tmp_div);
          console.timeEnd('init_post_reference_links');

          console.time('init_post_hashid_features');
          init_post_hashid_features(tmp_div);
          console.timeEnd('init_post_hashid_features');

          // move the new post elements from temp div to thread div
          const thread_div = document.querySelector('.thread');
          thread_div.appendChild(document.createElement('hr'));
          let new_posts = Array.from(tmp_div.children);
          new_posts.forEach((child) => {
            thread_div.appendChild(child);
          });

          console.time('init_post_backreference_links');
          init_post_backreference_links(new_posts);
          console.timeEnd('init_post_backreference_links');

          state.thread_auto_update.post_id_after = tmp_div_last_post_id;
        });
    }, 10000);
  }
}

function init_boardselect_mobile_features() {
  const select = document.getElementById('boardselect-mobile');
  if (select == null) {
    return;
  }

  select.addEventListener('change', (event) => {
    window.location.href = `/${event.target.value}/`;
  });
}

/**
 * Initializes features related to the settings menu button.
 */
function init_settings_features() {
  apply_settings();

  const anchors = document.querySelectorAll('#boardmenu-desktop-settings,#boardmenu-mobile-settings');
  if (anchors.length === 0) {
    return;
  }

  const settings_anchor_click_handler = (event) => {
    event.preventDefault();
    
    const existing_element = document.getElementById('settingswindow');
    if (existing_element) {
      existing_element.remove();
    } else {
      create_settings_window([
        { name: 'Set style', id: 'stylepicker', type: 'element', callback: (target) => {
          let style_expires = new Date();
          style_expires.setFullYear(style_expires.getFullYear() + 10);
          target.addEventListener('change', (event) => {
            storage.set_cookie('style', event.target.value, 'Lax', style_expires);
            location.reload();
          });
        } },
        { name: 'Menubar: detach', key: 'menubar_detach', type: 'bool', def: state.menubar_detach },
        { name: 'Thread: quick reply', key: 'thread_quickreply', type: 'bool', def: state.thread_quickreply },
        { name: 'Thread: auto update', key: 'thread_auto_update', type: 'bool', def: state.thread_auto_update },
        { name: 'Audio: loop', key: 'audio_loop', type: 'bool', def: state.audio_loop },
        { name: 'Video: loop', key: 'video_loop', type: 'bool', def: state.video_loop },
        { name: 'Audio: autoclose', key: 'audio_autoclose', type: 'bool', def: state.audio_autoclose },
        { name: 'Video: autoclose', key: 'video_autoclose', type: 'bool', def: state.video_autoclose },
        { name: 'Audio: volume', key: 'audio_volume', type: 'float_slider', min: 0, max: 1, step: 0.1, def: state.audio_volume },
        { name: 'Video: volume', key: 'video_volume', type: 'float_slider', min: 0, max: 1, step: 0.1, def: state.video_volume },
        { name: 'Flash: volume', key: 'swf_volume', type: 'float_slider', min: 0, max: 1, step: 0.1, def: state.swf_volume },
        { name: 'MOD: stereo', key: 'mod_stereo', type: 'float_slider', min: 0, max: 1, step: 0.1, def: state.mod_stereo },
        { name: 'CSS: override', key: 'css_override', type: 'string_multiline', def: '' },
        { name: 'JS: override', key: 'js_override', type: 'string_multiline', def: '' },
      ]);
    }
  };

  anchors.forEach((x) => x.addEventListener('click', settings_anchor_click_handler));
}

function init_gallery_features() {
  const anchors = document.querySelectorAll('#boardmenu-desktop-gallery,#boardmenu-mobile-gallery');
  if (anchors.length === 0) {
    return;
  }

  const gallery_anchor_click_handler = (event) => {
    event.preventDefault();

    const div_gallery_container = gallery.create();
    const div_fixed_window = ui_window.open(
      'gallerywindow',
      'Gallery (lctrl + scroll to resize)',
      0,
      0,
      null,
      null,
      false,
      div_gallery_container
    );
    document.body.appendChild(div_fixed_window.element);
  };

  anchors.forEach((x) => x.addEventListener('click', gallery_anchor_click_handler));
}

document.addEventListener('DOMContentLoaded', function(event) {
  console.time('init_settings_features');
  init_settings_features();
  console.timeEnd('init_settings_features');

  if (!location.pathname.includes('/catalog/') && !location.pathname.includes('/manage/')) {
    console.time('init_post_thumb_links');
    init_post_thumb_links();
    console.timeEnd('init_post_thumb_links');

    console.time('init_post_reference_links');
    init_post_reference_links();
    console.timeEnd('init_post_reference_links');

    console.time('init_post_backreference_links');
    init_post_backreference_links(null);
    console.timeEnd('init_post_backreference_links');

    console.time('init_location_hash_features');
    init_location_hash_features();
    console.timeEnd('init_location_hash_features');
  }

  console.time('init_dropdown_menu_buttons');
  init_dropdown_menu_buttons();
  console.timeEnd('init_dropdown_menu_buttons');

  console.time('init_post_hashid_features');
  init_post_hashid_features();
  console.timeEnd('init_post_hashid_features');
  
  console.time('init_postform_features');
  init_postform_features('');
  console.timeEnd('init_postform_features');
  
  console.time('init_deleteform_features');
  init_deleteform_features();
  console.timeEnd('init_deleteform_features');

  console.time('init_thread_features');
  init_thread_features();
  console.timeEnd('init_thread_features');

  console.time('init_boardselect_mobile_features');
  init_boardselect_mobile_features();
  console.timeEnd('init_boardselect_mobile_features');

  console.time('init_gallery_features');
  init_gallery_features();
  console.timeEnd('init_gallery_features');
});
